package com.typoem.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TypoemWindowPlugin.class);   // the colour behind the system bars (light / dark)
        super.onCreate(savedInstanceState);
    }
}
