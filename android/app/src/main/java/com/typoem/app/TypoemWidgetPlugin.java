package com.typoem.app;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Today's poem for the home screen widget (TodayPoemWidget).
 *
 * The web home calls this when it has today's poem, so the widget never asks the
 * server itself (no login token leaves the web view):
 *
 *   TypoemWidget.update({ date: "2026-11-13", title, author, lines: ["first", "second"] })
 *     date: Seoul date "YYYY-MM-DD"   lines: 0-2 plain-text lines
 */
@CapacitorPlugin(name = "TypoemWidget")
public class TypoemWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        JSArray lines = call.getArray("lines", new JSArray());
        Context context = getContext();
        context.getSharedPreferences(TodayPoemWidget.PREFS, Context.MODE_PRIVATE).edit()
            .putString("date", call.getString("date", ""))
            .putString("title", call.getString("title", ""))
            .putString("author", call.getString("author", ""))
            .putString("line1", lines.optString(0, ""))
            .putString("line2", lines.optString(1, ""))
            .apply();
        TodayPoemWidget.updateAll(context);
        call.resolve();
    }
}
