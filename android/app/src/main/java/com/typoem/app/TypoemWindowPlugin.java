package com.typoem.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The colour behind the system bars follows the page (light / dark theme).
 *
 * On Android 15+ the app is edge-to-edge; when the web view is kept clear of the
 * status bar and the navigation bar, those strips show the window background
 * (@color/typoem_paper, white). In the dark theme that left white bands at the top
 * and bottom. app-shell.js calls setBackground with the page's --bg after each page
 * loads and when the theme changes.
 *
 *   TypoemWindow.setBackground({ color: "#161e20", light: false })
 *     color: "#rrggbb"   light: true = dark icons in the navigation bar (light page)
 */
@CapacitorPlugin(name = "TypoemWindow")
public class TypoemWindowPlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        String value = call.getString("color", "#ffffff");
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", true));
        final int color;
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            call.reject("color must be #rrggbb");
            return;
        }
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.setBackgroundDrawable(new ColorDrawable(color));
            window.getDecorView().setBackgroundColor(color);
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightNavigationBars(light);
            call.resolve();
        });
    }
}
