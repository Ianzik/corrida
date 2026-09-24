package br.com.ianzik.treinocorrida;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O plugin precisa ser registrado antes de a ponte com o site ser criada.
        registerPlugin(TreinoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
