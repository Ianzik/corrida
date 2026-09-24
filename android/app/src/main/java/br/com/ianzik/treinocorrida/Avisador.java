package br.com.ianzik.treinocorrida;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;

/**
 * Toca os avisos: bipe, som de troca, vibração e voz em português.
 *
 * Antes de tocar, pede ao Android um "foco de áudio transitório com
 * ducking": a música (Spotify etc.) abaixa um instante e volta sozinha,
 * sem pausar. O foco é devolvido quando a voz termina.
 */
final class Avisador implements TextToSpeech.OnInitListener {
    private static final int TAXA = 44100;

    // { frequência Hz, duração ms, pausa depois ms, volume 0..1 }. Mesmas notas do site.
    private static final double[][] NOTAS_CORRIDA = { { 660, 150, 40, 0.6 }, { 880, 280, 0, 0.6 } };
    private static final double[][] NOTAS_CAMINHADA = { { 440, 150, 40, 0.6 }, { 330, 280, 0, 0.6 } };
    private static final double[][] NOTAS_FIM = { { 523, 150, 30, 0.6 }, { 659, 150, 30, 0.6 }, { 784, 450, 0, 0.6 } };
    private static final double[][] NOTAS_BIP = { { 520, 90, 0, 0.45 } };

    private static final long[] VIBRA_CORRIDA = { 0, 200, 100, 200 };
    private static final long[] VIBRA_CAMINHADA = { 0, 400 };
    private static final long[] VIBRA_FIM = { 0, 300, 100, 300, 100, 300 };
    private static final long[] VIBRA_BIP = { 0, 80 };

    private final Context ctx;
    private final Handler handler;
    private final AudioManager audio;
    private final Vibrator vibrador;
    private final AudioAttributes atributosSom;
    private final AudioAttributes atributosVoz;
    private AudioFocusRequest pedidoFoco;
    private boolean comFoco = false;
    private TextToSpeech tts;
    private boolean vozPronta = false;
    private int contadorFala = 0;
    private final Runnable soltarFoco = this::soltarFoco;
    private final AudioManager.OnAudioFocusChangeListener ouvinteFoco = mudanca -> { };

    Avisador(Context contexto, Handler handler) {
        this.ctx = contexto.getApplicationContext();
        this.handler = handler;
        this.audio = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            this.vibrador = vm.getDefaultVibrator();
        } else {
            this.vibrador = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        }
        // "Orientação de navegação": o mesmo tipo de áudio que o GPS usa
        // para falar por cima da música.
        this.atributosSom = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        this.atributosVoz = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build();
        if (Build.VERSION.SDK_INT >= 26) {
            pedidoFoco = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(atributosSom)
                .setOnAudioFocusChangeListener(ouvinteFoco, handler)
                .setWillPauseWhenDucked(false)
                .build();
        }
        tts = new TextToSpeech(ctx, this);
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) return;
        int r = tts.setLanguage(new Locale("pt", "BR"));
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) return;
        tts.setAudioAttributes(atributosVoz);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { handler.postDelayed(soltarFoco, 300); }
            @Override public void onError(String id) { handler.post(soltarFoco); }
        });
        vozPronta = true;
    }

    /** Bipe curto da contagem 3, 2, 1. */
    void bip() {
        pegarFoco(1600);
        tocarNotas(NOTAS_BIP);
        vibrar(VIBRA_BIP);
    }

    /** Aviso de troca: tipo = "corrida", "caminhada" ou "fim". */
    void troca(String tipo, final String fala) {
        double[][] notas;
        long[] vibra;
        if ("corrida".equals(tipo)) { notas = NOTAS_CORRIDA; vibra = VIBRA_CORRIDA; }
        else if ("fim".equals(tipo)) { notas = NOTAS_FIM; vibra = VIBRA_FIM; }
        else { notas = NOTAS_CAMINHADA; vibra = VIBRA_CAMINHADA; }

        // Segura o foco por no máximo 8 s, caso a voz nunca avise que terminou.
        pegarFoco(8000);
        long duracao = tocarNotas(notas);
        vibrar(vibra);
        if (fala != null && !fala.isEmpty()) {
            handler.postDelayed(() -> falar(fala), duracao + 120);
        } else {
            handler.removeCallbacks(soltarFoco);
            handler.postDelayed(soltarFoco, duracao + 300);
        }
    }

    boolean ocupado() {
        return comFoco;
    }

    void liberar() {
        handler.removeCallbacks(soltarFoco);
        soltarFoco();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }

    // ---------------- partes internas ----------------

    private void falar(String texto) {
        if (!vozPronta || tts == null) {
            handler.removeCallbacks(soltarFoco);
            handler.postDelayed(soltarFoco, 300);
            return;
        }
        tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "aviso" + (++contadorFala));
    }

    private void pegarFoco(long segurarPorMs) {
        handler.removeCallbacks(soltarFoco);
        handler.postDelayed(soltarFoco, segurarPorMs);
        if (comFoco) return;
        int r;
        if (Build.VERSION.SDK_INT >= 26) {
            r = audio.requestAudioFocus(pedidoFoco);
        } else {
            r = audio.requestAudioFocus(ouvinteFoco, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
        // Mesmo sem foco (ex.: numa ligação) o aviso toca; só não abaixa a música.
        comFoco = r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void soltarFoco() {
        if (!comFoco) return;
        if (Build.VERSION.SDK_INT >= 26) audio.abandonAudioFocusRequest(pedidoFoco);
        else audio.abandonAudioFocus(ouvinteFoco);
        comFoco = false;
    }

    /** Gera as notas em tempo real (sem arquivos de áudio). Devolve a duração em ms. */
    private long tocarNotas(double[][] notas) {
        int total = 0;
        for (double[] n : notas) total += (int) ((n[1] + n[2]) * TAXA / 1000);
        short[] amostras = new short[Math.max(total, 1)];
        int pos = 0;
        for (double[] n : notas) {
            int qtd = (int) (n[1] * TAXA / 1000);
            double subida = 0.01 * TAXA;
            for (int i = 0; i < qtd; i++) {
                // Sobe rápido (10 ms) e some suavemente, como no site.
                double env = i < subida ? i / subida : Math.exp(-5.0 * (i - subida) / Math.max(qtd - subida, 1));
                double v = Math.sin(2 * Math.PI * n[0] * i / TAXA) * env * n[3];
                amostras[pos + i] = (short) (v * Short.MAX_VALUE);
            }
            pos += qtd + (int) (n[2] * TAXA / 1000);
        }
        final long duracaoMs = (long) total * 1000 / TAXA;
        try {
            final AudioTrack faixa = new AudioTrack.Builder()
                .setAudioAttributes(atributosSom)
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(TAXA)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(amostras.length * 2)
                .build();
            faixa.write(amostras, 0, amostras.length);
            faixa.play();
            handler.postDelayed(faixa::release, duracaoMs + 500);
        } catch (Exception e) {
            // Sem som desta vez; a vibração e a voz ainda avisam.
        }
        return duracaoMs;
    }

    private void vibrar(long[] padrao) {
        if (vibrador == null || !vibrador.hasVibrator()) return;
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                vibrador.vibrate(VibrationEffect.createWaveform(padrao, -1),
                    VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM));
            } else if (Build.VERSION.SDK_INT >= 26) {
                AudioAttributes alarme = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
                vibrador.vibrate(VibrationEffect.createWaveform(padrao, -1), alarme);
            } else {
                vibrador.vibrate(padrao, -1);
            }
        } catch (Exception e) {
            // Alguns aparelhos recusam vibração em modos especiais; o som continua.
        }
    }
}
