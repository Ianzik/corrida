package br.com.ianzik.treinocorrida;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Serviço em primeiro plano do treino.
 *
 * Recebe do site a "agenda" da sessão (lista de avisos com horário
 * absoluto) e toca cada aviso na hora certa, mesmo com a tela apagada
 * e o app fechado. Enquanto o treino roda, segura um wake lock parcial
 * (processador acordado, tela apagada): com um serviço em primeiro plano
 * ativo, o Android respeita esse wake lock inclusive no modo Doze.
 *
 * Mostra a notificação fixa "Treino em andamento" com Pausar/Continuar
 * e Encerrar. Tudo o que muda aqui fica salvo (Armazem), e o site lê ao
 * abrir.
 */
public class TreinoService extends Service {
    static final String ACAO_RETOMAR = "br.com.ianzik.treinocorrida.RETOMAR";
    static final String ACAO_PAUSAR = "br.com.ianzik.treinocorrida.PAUSAR";
    static final String ACAO_CONTINUAR = "br.com.ianzik.treinocorrida.CONTINUAR";
    static final String ACAO_ENCERRAR = "br.com.ianzik.treinocorrida.ENCERRAR";

    private static final String CANAL = "treino";
    private static final int ID_NOTIFICACAO = 1;
    private static final long VIGIA_MS = 15_000; // confere o relógio no máximo a cada 15 s
    private static final long ESPERA_PARA_FECHAR_MS = 7_000; // deixa a voz terminar

    /** Instância viva (ou null). Usada pelo plugin para falar direto com o serviço. */
    static volatile TreinoService instancia;
    /** Avisa o site (se aberto) que algo mudou fora dele. */
    static volatile Runnable ouvinte;

    private HandlerThread linha;
    private Handler handler;
    private Avisador avisador;
    private PowerManager.WakeLock wakeLock;

    private JSONObject sessao;   // estado atual, com a agenda
    private JSONArray agenda;
    private int proximo = 0;     // próximo item da agenda a tocar
    private int ultimoIndiceAnunciado = -1;
    private boolean fimAnunciado = false;
    private volatile boolean emPrimeiroPlano = false;

    private final Runnable tique = this::processar;
    private final Runnable fechar = this::fecharAgora;

    // =================== chamadas vindas do plugin ===================

    static void receberDoApp(Context ctx, JSONObject dados) {
        TreinoService s = instancia;
        if (s != null) {
            s.handler.post(() -> s.receber(dados));
            return;
        }
        // Serviço parado: grava e liga. Só acontece com o app na tela,
        // quando o Android permite iniciar serviço em primeiro plano.
        Armazem.salvarSessao(ctx, dados);
        Intent i = new Intent(ctx, TreinoService.class).setAction(ACAO_RETOMAR);
        try {
            ContextCompat.startForegroundService(ctx, i);
        } catch (Exception e) {
            // Sem permissão para iniciar agora (app em segundo plano):
            // ao reabrir, o site sincroniza de novo.
        }
    }

    static void pararDoApp(Context ctx) {
        TreinoService s = instancia;
        if (s != null) s.handler.post(s::parar);
        else Armazem.limparSessao(ctx);
    }

    /** Devolve false se o serviço não estiver rodando (o plugin toca por conta própria). */
    static boolean tocarDoApp(String tipo, int indice, String fala) {
        TreinoService s = instancia;
        if (s == null) return false;
        s.handler.post(() -> s.tocarPedido(tipo, indice, fala));
        return true;
    }

    // =================== ciclo de vida ===================

    @Override
    public void onCreate() {
        super.onCreate();
        linha = new HandlerThread("treino");
        linha.start();
        handler = new Handler(linha.getLooper());
        avisador = new Avisador(this, handler);
        criarCanal();
        instancia = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instancia = this;
        handler.removeCallbacks(fechar);
        // O Android exige chamar startForeground logo após o início.
        entrarEmPrimeiroPlano(construirNotificacao());
        final String acao = intent != null ? intent.getAction() : null;
        handler.post(() -> {
            // Botão da notificação com o serviço recém-criado: carrega o treino salvo antes.
            if (sessao == null && acao != null && !ACAO_RETOMAR.equals(acao)) retomarDoDisco();
            if (ACAO_PAUSAR.equals(acao)) pausar();
            else if (ACAO_CONTINUAR.equals(acao)) continuar();
            else if (ACAO_ENCERRAR.equals(acao)) encerrar();
            else retomarDoDisco(); // início normal, ou o Android recriou o serviço
        });
        // Se o Android matar o processo, ele recria o serviço sozinho.
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (instancia == this) instancia = null;
        handler.removeCallbacksAndMessages(null);
        soltarWakeLock();
        avisador.liberar();
        linha.quitSafely();
        super.onDestroy();
    }

    // =================== lógica (sempre na linha "treino") ===================

    private void retomarDoDisco() {
        JSONObject salva = Armazem.carregarSessao(this);
        if (salva == null) {
            if (sessao == null) fecharAgora();
            return;
        }
        if (sessao != null && salva.optLong("atualizadaEm") < sessao.optLong("atualizadaEm")) return;
        aplicar(salva, true);
    }

    private void receber(JSONObject dados) {
        if (sessao != null && dados.optLong("atualizadaEm") < sessao.optLong("atualizadaEm")) return; // velho
        if (sessao == null || sessao.optInt("posicao") != dados.optInt("posicao")) {
            ultimoIndiceAnunciado = -1;
            fimAnunciado = false;
        }
        aplicar(dados, false);
    }

    private void aplicar(JSONObject dados, boolean veioDoDisco) {
        handler.removeCallbacks(fechar);
        sessao = dados;
        agenda = dados.optJSONArray("agenda");
        if (agenda == null) agenda = new JSONArray();
        long agora = System.currentTimeMillis();
        if (veioDoDisco && dados.has("proximo")) {
            // Recriado pelo Android: continua de onde parou e toca o que venceu.
            proximo = dados.optInt("proximo", 0);
        } else {
            // Vindo do site: o que já passou, o site já avisou.
            proximo = 0;
            while (proximo < agenda.length() && em(proximo) <= agora) proximo++;
        }
        if (!veioDoDisco && dados.optInt("indice", -1) >= 0) {
            // O bloco atual já foi anunciado pelo site (ou pelo próprio serviço).
            if (ultimoIndiceAnunciado == -1) ultimoIndiceAnunciado = dados.optInt("indice");
        }
        salvar();
        if (sessao.optBoolean("rodando")) {
            pegarWakeLock();
            processar();
        } else {
            handler.removeCallbacks(tique);
            soltarWakeLock();
        }
        atualizarNotificacao();
    }

    /** Toca o que venceu e agenda a próxima conferência. */
    private void processar() {
        handler.removeCallbacks(tique);
        if (sessao == null || !sessao.optBoolean("rodando")) return;
        long agora = System.currentTimeMillis();

        // Se o celular atrasou e várias trocas passaram, toca só a mais
        // recente. Bipes atrasados mais de 1,5 s são descartados.
        JSONObject ultimaTroca = null;
        JSONObject bip = null;
        while (proximo < agenda.length() && em(proximo) <= agora) {
            JSONObject item = agenda.optJSONObject(proximo);
            proximo++;
            if (item == null) continue;
            if ("bip".equals(item.optString("acao"))) bip = item;
            else { ultimaTroca = item; bip = null; }
        }

        if (ultimaTroca != null) {
            if ("fim".equals(ultimaTroca.optString("acao"))) {
                concluir(ultimaTroca.optLong("em"), "completa", ultimaTroca.optString("fala", "Sessão concluída"));
                return;
            }
            int indice = ultimaTroca.optInt("indice");
            try {
                sessao.put("indice", indice);
                sessao.put("fimDoIntervalo", ultimaTroca.optLong("fimDoBloco"));
                JSONObject bloco = new JSONObject();
                bloco.put("descricao", ultimaTroca.optString("descricao"));
                bloco.put("tipo", ultimaTroca.optString("tipo"));
                sessao.put("blocoAtual", bloco);
            } catch (JSONException e) { /* não acontece com chaves fixas */ }
            if (indice != ultimoIndiceAnunciado) {
                ultimoIndiceAnunciado = indice;
                avisador.troca(ultimaTroca.optString("tipo"), ultimaTroca.optString("fala"));
            }
            atualizarNotificacao();
        }
        if (bip != null && agora - bip.optLong("em") <= 1500) avisador.bip();
        salvar();

        if (proximo < agenda.length()) {
            long espera = Math.max(0, em(proximo) - System.currentTimeMillis());
            handler.postDelayed(tique, Math.min(espera, VIGIA_MS));
        }
    }

    private void pausar() {
        if (sessao == null || !sessao.optBoolean("rodando")) return;
        long agora = System.currentTimeMillis();
        long fim = sessao.optLong("fimDoIntervalo");
        long restantes = Math.max((long) Math.ceil((fim - agora) / 1000.0), 0);
        try {
            sessao.put("rodando", false);
            sessao.put("segundosRestantes", restantes);
            sessao.put("atualizadaEm", agora);
        } catch (JSONException e) { return; }
        handler.removeCallbacks(tique);
        soltarWakeLock();
        salvar();
        atualizarNotificacao();
        avisarSite();
    }

    private void continuar() {
        if (sessao == null || sessao.optBoolean("rodando")) return;
        long agora = System.currentTimeMillis();
        long novoFim = agora + sessao.optLong("segundosRestantes") * 1000;
        long delta = novoFim - sessao.optLong("fimDoIntervalo");
        try {
            // Empurra todos os avisos pelo tempo que ficou pausado.
            for (int i = 0; i < agenda.length(); i++) {
                JSONObject item = agenda.getJSONObject(i);
                item.put("em", item.optLong("em") + delta);
                if (!item.isNull("fimDoBloco") && item.has("fimDoBloco")) {
                    item.put("fimDoBloco", item.optLong("fimDoBloco") + delta);
                }
            }
            sessao.put("fimDoIntervalo", novoFim);
            sessao.put("rodando", true);
            sessao.put("atualizadaEm", agora);
        } catch (JSONException e) { return; }
        proximo = 0;
        while (proximo < agenda.length() && em(proximo) <= agora) proximo++;
        pegarWakeLock();
        salvar();
        processar();
        atualizarNotificacao();
        avisarSite();
    }

    private void encerrar() {
        if (sessao == null) { fecharAgora(); return; }
        concluir(System.currentTimeMillis(), "manual", "Sessão concluída");
    }

    private void concluir(long quando, String tipo, String fala) {
        Armazem.adicionarConclusao(this, sessao.optInt("posicao"), quando, tipo);
        if (!fimAnunciado) {
            fimAnunciado = true;
            avisador.troca("fim", fala);
        }
        String titulo = sessao.optString("titulo");
        sessao = null;
        agenda = new JSONArray();
        Armazem.limparSessao(this);
        handler.removeCallbacks(tique);
        soltarWakeLock();
        mostrarConcluida(titulo);
        avisarSite();
        handler.postDelayed(fechar, ESPERA_PARA_FECHAR_MS);
    }

    /** O site encerrou ou descartou a sessão. */
    private void parar() {
        sessao = null;
        agenda = new JSONArray();
        Armazem.limparSessao(this);
        handler.removeCallbacks(tique);
        soltarWakeLock();
        handler.removeCallbacks(fechar);
        handler.postDelayed(fechar, avisador.ocupado() ? ESPERA_PARA_FECHAR_MS : 0);
    }

    /** Aviso pedido pelo site (troca natural ou pulo de bloco). */
    private void tocarPedido(String tipo, int indice, String fala) {
        if ("fim".equals(tipo)) {
            if (fimAnunciado) return;
            fimAnunciado = true;
        } else {
            // Se o próprio serviço já anunciou este bloco, não repete.
            if (indice == ultimoIndiceAnunciado) return;
            ultimoIndiceAnunciado = indice;
        }
        avisador.troca(tipo, fala);
    }

    private void fecharAgora() {
        if (sessao != null) return; // começou outra sessão nesse meio tempo
        soltarWakeLock();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        emPrimeiroPlano = false;
        // Solta a referência antes: se o site mandar outro treino agora,
        // o plugin liga o serviço de novo em vez de falar com este que está saindo.
        if (instancia == this) instancia = null;
        stopSelf();
    }

    // =================== apoio ===================

    private long em(int i) {
        JSONObject item = agenda.optJSONObject(i);
        return item == null ? Long.MAX_VALUE : item.optLong("em");
    }

    private void salvar() {
        if (sessao == null) return;
        try {
            sessao.put("proximo", proximo);
        } catch (JSONException e) { /* ignora */ }
        Armazem.salvarSessao(this, sessao);
    }

    private void avisarSite() {
        Runnable r = ouvinte;
        if (r != null) r.run();
    }

    private void pegarWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TreinoCorrida:sessao");
            wakeLock.setReferenceCounted(false);
        }
        // Limite de segurança: 3 h. Renovado a cada início/continuação.
        wakeLock.acquire(3 * 60 * 60 * 1000L);
    }

    private void soltarWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }

    // =================== notificação ===================

    private void criarCanal() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Treino em andamento", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("Mostra o bloco atual e os botões Pausar e Encerrar durante o treino.");
        canal.setShowBadge(false);
        canal.setSound(null, null);
        canal.enableVibration(false);
        canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        getSystemService(NotificationManager.class).createNotificationChannel(canal);
    }

    private PendingIntent acao(String acao, int codigo) {
        Intent i = new Intent(this, TreinoService.class).setAction(acao);
        return PendingIntent.getService(this, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent abrirApp() {
        Intent i = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private NotificationCompat.Builder base() {
        return new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_notificacao)
            .setContentIntent(abrirApp())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
    }

    private Notification construirNotificacao() {
        NotificationCompat.Builder b = base();
        if (sessao == null) {
            return b.setContentTitle("Treino em andamento").setContentText("Preparando…").build();
        }
        JSONObject bloco = sessao.optJSONObject("blocoAtual");
        String descricao = bloco != null ? bloco.optString("descricao") : "";
        String titulo = sessao.optString("titulo");
        boolean rodando = sessao.optBoolean("rodando");
        if (rodando) {
            // Contagem regressiva desenhada pelo próprio Android (não gasta bateria).
            b.setContentTitle(descricao)
                .setContentText(titulo + " · treino em andamento")
                .setWhen(sessao.optLong("fimDoIntervalo"))
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .addAction(0, "Pausar", acao(ACAO_PAUSAR, 1));
        } else {
            long s = sessao.optLong("segundosRestantes");
            b.setContentTitle("Pausado · " + descricao)
                .setContentText(titulo + " · faltam " + String.format(java.util.Locale.ROOT, "%02d:%02d", s / 60, s % 60) + " neste bloco")
                .setShowWhen(false)
                .addAction(0, "Continuar", acao(ACAO_CONTINUAR, 2));
        }
        b.addAction(0, "Encerrar", acao(ACAO_ENCERRAR, 3));
        return b.build();
    }

    private void atualizarNotificacao() {
        entrarEmPrimeiroPlano(construirNotificacao());
    }

    private void mostrarConcluida(String titulo) {
        Notification n = base()
            .setOngoing(false)
            .setContentTitle("Sessão concluída")
            .setContentText(titulo)
            .build();
        entrarEmPrimeiroPlano(n);
    }

    private void entrarEmPrimeiroPlano(Notification n) {
        if (emPrimeiroPlano) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(ID_NOTIFICACAO, n);
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    // Tipo "health": o indicado pelo Android para apps de exercício.
                    startForeground(ID_NOTIFICACAO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
                } catch (SecurityException e) {
                    // Plano B, caso alguma versão do Android recuse o "health".
                    startForeground(ID_NOTIFICACAO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
                }
            } else {
                startForeground(ID_NOTIFICACAO, n);
            }
            emPrimeiroPlano = true;
        } catch (Exception e) {
            // O Android não deixou (ex.: recriado em segundo plano sem permissão).
            // Sem primeiro plano os avisos não são confiáveis: encerra, e o site
            // reconcilia pelo relógio quando for aberto.
            stopSelf();
        }
    }
}
