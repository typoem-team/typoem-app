package com.typoem.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Home screen widget "오늘의 시": today's poem as the web home last sent it
 * (TypoemWidgetPlugin). A poem from another day, or none yet, shows
 * "Typoem을 열면 오늘의 시가 와요" instead. The date is checked on every draw, and
 * the system redraws every 30 minutes (updatePeriodMillis), so the poem goes
 * away within half an hour after midnight in Seoul.
 */
public class TodayPoemWidget extends AppWidgetProvider {

    static final String PREFS = "typoem_widget";
    /** The widget's tap: MainActivity sends the web view home when it gets this. */
    static final String ACTION_OPEN_HOME = "com.typoem.app.OPEN_HOME";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) draw(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        draw(context, manager, id);   // resized: fit the number of poem lines again
    }

    /** Redraws every "오늘의 시" widget on the home screen. */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, TodayPoemWidget.class))) {
            draw(context, manager, id);
        }
    }

    /** "YYYY-MM-DD" in Seoul, the same calendar the web's date uses. */
    static String seoulDate(long millis) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
        return format.format(new Date(millis));
    }

    /**
     * Poem lines that fit under the label, title and author at this height (dp),
     * so nothing is cut off at the smallest size. 0 = the launcher didn't say.
     */
    static int linesThatFit(int heightDp) {
        if (heightDp == 0) return 2;
        // label 15 + title 24 + author 18 + padding 24 = ~81dp, each poem line ~21dp more
        if (heightDp < 105) return 0;
        if (heightDp < 125) return 1;
        return 2;
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        SharedPreferences saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean today = seoulDate(System.currentTimeMillis()).equals(saved.getString("date", null));
        // MIN_HEIGHT is the smaller of the portrait / landscape heights: fits both.
        int lines = linesThatFit(manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_poem);
        views.setViewVisibility(R.id.widget_empty, today ? View.GONE : View.VISIBLE);
        show(views, R.id.widget_title, saved.getString("title", ""), today);
        show(views, R.id.widget_author, saved.getString("author", ""), today);
        show(views, R.id.widget_line1, saved.getString("line1", ""), today && lines >= 1);
        show(views, R.id.widget_line2, saved.getString("line2", ""), today && lines >= 2);

        Intent open = new Intent(context, MainActivity.class).setAction(ACTION_OPEN_HOME);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        manager.updateAppWidget(id, views);
    }

    private static void show(RemoteViews views, int viewId, String text, boolean visible) {
        views.setTextViewText(viewId, text);
        views.setViewVisibility(viewId, visible && !text.isEmpty() ? View.VISIBLE : View.GONE);
    }
}
