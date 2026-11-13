package com.typoem.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TypoemWindowPlugin.class);   // the colour behind the system bars (light / dark)
        registerPlugin(TypoemWidgetPlugin.class);   // today's poem for the home screen widget
        super.onCreate(savedInstanceState);
    }

    // The widget's tap opens that room's poem (or home). This also runs on a cold
    // start: BridgeActivity.load() passes the launch intent here.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && TodayPoemWidget.ACTION_OPEN.equals(intent.getAction()) && getBridge() != null) {
            String url = getBridge().getLocalUrl() + TodayPoemWidget.openPath(intent.getStringExtra("roomId"));
            WebView web = getBridge().getWebView();
            web.post(() -> web.loadUrl(url));   // after the bridge's own first load, which is posted too
        }
    }
}
