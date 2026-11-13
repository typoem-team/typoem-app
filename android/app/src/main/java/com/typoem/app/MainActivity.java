package com.typoem.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TypoemWindowPlugin.class);   // the colour behind the system bars (light / dark)
        registerPlugin(TypoemWidgetPlugin.class);   // today's poem for the home screen widget
        super.onCreate(savedInstanceState);
    }

    // The widget's tap shows home. A cold start opens index.html anyway; this is for
    // an app left in the background on another page.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (TodayPoemWidget.ACTION_OPEN_HOME.equals(intent.getAction()) && getBridge() != null) {
            getBridge().getWebView().evaluateJavascript(
                "if (location.pathname !== '/' && location.pathname !== '/index.html') location.href = '/index.html';",
                null);
        }
    }
}
