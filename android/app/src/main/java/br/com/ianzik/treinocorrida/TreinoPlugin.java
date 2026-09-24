package br.com.ianzik.treinocorrida;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Ponte entre o site (js/alertas.js, js/permissoes.js) e o Android.
 * No JavaScript ela aparece como o plugin "Treino".
 */
@CapacitorPlugin(
    name = "Treino",
    permissions = { @Permission(alias = "notificacoes", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class TreinoPlugin extends Plugin {
    private long ultimaConclusaoLida = 0;
    private Avisador avisadorAvulso; // para tocar quando o serviço não está rodando
    private Handler handlerAvulso;

    @Override
    public void load() {
        TreinoService.ouvinte = () -> notifyListeners("mudou", new JSObject());
    }

    @Override
    protected void handleOnDestroy() {
        TreinoService.ouvinte = null;
        if (avisadorAvulso != null) avisadorAvulso.liberar();
    }

    // ---------------- treino ----------------

    @PluginMethod
    public void sincronizar(PluginCall call) {
        TreinoService.receberDoApp(getContext(), call.getData());
        call.resolve();
    }

    @PluginMethod
    public void parar(PluginCall call) {
        TreinoService.pararDoApp(getContext());
        call.resolve();
    }

    @PluginMethod
    public void tocar(PluginCall call) {
        String tipo = call.getString("tipo", "caminhada");
        int indice = call.getInt("indice", -1);
        String fala = call.getString("fala", "");
        if (!TreinoService.tocarDoApp(tipo, indice, fala)) {
            // Serviço parado (ex.: fim detectado pelo site): toca daqui mesmo.
            if (avisadorAvulso == null) {
                HandlerThread t = new HandlerThread("avisos");
                t.start();
                handlerAvulso = new Handler(t.getLooper());
                avisadorAvulso = new Avisador(getContext(), handlerAvulso);
            }
            handlerAvulso.post(() -> avisadorAvulso.troca(tipo, fala));
        }
        call.resolve();
    }

    @PluginMethod
    public void obterEstado(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        JSONObject sessao = Armazem.carregarSessao(ctx);
        if (sessao != null) {
            JSObject s = new JSObject();
            s.put("posicao", sessao.optInt("posicao"));
            s.put("indice", sessao.optInt("indice"));
            s.put("rodando", sessao.optBoolean("rodando"));
            s.put("fimDoIntervalo", sessao.optLong("fimDoIntervalo"));
            s.put("segundosRestantes", sessao.optLong("segundosRestantes"));
            s.put("atualizadaEm", sessao.optLong("atualizadaEm"));
            if (!sessao.isNull("iniciadaEm")) s.put("iniciadaEm", sessao.optLong("iniciadaEm"));
            ret.put("sessao", s);
        } else {
            ret.put("sessao", JSONObject.NULL);
        }
        JSONArray lista = Armazem.lerConclusoes(ctx);
        JSArray conclusoes = new JSArray();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject c = lista.optJSONObject(i);
            if (c == null) continue;
            conclusoes.put(c);
            ultimaConclusaoLida = Math.max(ultimaConclusaoLida, c.optLong("em"));
        }
        ret.put("conclusoes", conclusoes);
        call.resolve(ret);
    }

    @PluginMethod
    public void limparConclusoes(PluginCall call) {
        Armazem.removerConclusoesAte(getContext(), ultimaConclusaoLida);
        call.resolve();
    }

    // ---------------- permissões ----------------

    private String estadoNotificacoes() {
        boolean ligadas = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT < 33) return ligadas ? "granted" : "denied";
        PermissionState estado = getPermissionState("notificacoes");
        if (estado == PermissionState.GRANTED && !ligadas) return "denied"; // desligadas nas configurações
        return estado.toString();
    }

    @PluginMethod
    public void verificarPermissoes(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("notificacoes", estadoNotificacoes());
        boolean restrita = false;
        if (Build.VERSION.SDK_INT >= 28) {
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            restrita = am.isBackgroundRestricted();
        }
        ret.put("bateriaRestrita", restrita);
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        ret.put("semOtimizacao", pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        call.resolve(ret);
    }

    @PluginMethod
    public void pedirNotificacoes(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notificacoes") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("notificacoes", estadoNotificacoes());
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notificacoes", call, "depoisDePedirNotificacoes");
    }

    @PermissionCallback
    private void depoisDePedirNotificacoes(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("notificacoes", estadoNotificacoes());
        call.resolve(ret);
    }

    @PluginMethod
    public void pedirSemOtimizacao(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir o pedido de bateria.");
        }
    }

    @PluginMethod
    public void abrirConfiguracao(PluginCall call) {
        String tipo = call.getString("tipo", "app");
        String pacote = getContext().getPackageName();
        Intent i;
        if ("notificacoes".equals(tipo) && Build.VERSION.SDK_INT >= 26) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, pacote);
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pacote));
        }
        try {
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir as configurações.");
        }
    }

    // ---------------- exportar progresso ----------------

    @PluginMethod
    public void compartilhar(PluginCall call) {
        String texto = call.getString("texto", "");
        try {
            File arquivo = new File(getContext().getCacheDir(), "progresso-treino-corrida.json");
            try (FileOutputStream out = new FileOutputStream(arquivo)) {
                out.write(texto.getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", arquivo);
            Intent envio = new Intent(Intent.ACTION_SEND)
                .setType("application/json")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_TEXT, texto)
                .putExtra(Intent.EXTRA_SUBJECT, "Progresso do Treino de Corrida")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(envio, "Enviar progresso"));
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível compartilhar.");
        }
    }
}
