package br.com.ianzik.treinocorrida;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Guarda no celular o treino em andamento e as sessões concluídas pelo
 * serviço, para sobreviver a o Android matar o app. O site lê isso ao
 * abrir (TreinoPlugin.obterEstado).
 */
final class Armazem {
    private static final String ARQUIVO = "treino";
    private static final String SESSAO = "sessao";
    private static final String CONCLUSOES = "conclusoes";

    private Armazem() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE);
    }

    static synchronized void salvarSessao(Context ctx, JSONObject sessao) {
        prefs(ctx).edit().putString(SESSAO, sessao.toString()).commit();
    }

    static synchronized JSONObject carregarSessao(Context ctx) {
        String texto = prefs(ctx).getString(SESSAO, null);
        if (texto == null) return null;
        try {
            return new JSONObject(texto);
        } catch (JSONException e) {
            return null;
        }
    }

    static synchronized void limparSessao(Context ctx) {
        prefs(ctx).edit().remove(SESSAO).commit();
    }

    static synchronized void adicionarConclusao(Context ctx, int posicao, long em, String tipo) {
        JSONArray lista = lerConclusoes(ctx);
        try {
            JSONObject c = new JSONObject();
            c.put("posicao", posicao);
            c.put("em", em);
            c.put("tipo", tipo);
            lista.put(c);
        } catch (JSONException e) {
            return;
        }
        prefs(ctx).edit().putString(CONCLUSOES, lista.toString()).commit();
    }

    static synchronized JSONArray lerConclusoes(Context ctx) {
        String texto = prefs(ctx).getString(CONCLUSOES, null);
        if (texto == null) return new JSONArray();
        try {
            return new JSONArray(texto);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Remove só as conclusões que o site já leu (as com horário até "ate"). */
    static synchronized void removerConclusoesAte(Context ctx, long ate) {
        JSONArray lista = lerConclusoes(ctx);
        JSONArray resto = new JSONArray();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject c = lista.optJSONObject(i);
            if (c != null && c.optLong("em", 0) > ate) resto.put(c);
        }
        prefs(ctx).edit().putString(CONCLUSOES, resto.toString()).commit();
    }
}
