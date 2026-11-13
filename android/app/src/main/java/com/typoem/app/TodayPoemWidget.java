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
 * Home screen widget "오늘의 시": today's poem and the reading streak as the web
 * last sent them (TypoemWidgetPlugin). A poem from another day, or none yet, shows
 * "Typoem을 열면 오늘의 시가 와요" instead. Dates are checked on every draw, and the
 * system redraws every 30 minutes (updatePeriodMillis), so the widget catches up
 * within half an hour after midnight in Seoul.
 */
public class TodayPoemWidget extends AppWidgetProvider {

    static final String PREFS = "typoem_widget";
    /** The widget's tap (extra "roomId"): MainActivity opens that room's poem, or home. */
    static final String ACTION_OPEN = "com.typoem.app.OPEN_HOME";   // name kept from v1.0 widgets
    static final int[] BADGES = {3, 7, 30};                         // the server's streak badges

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) draw(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        draw(context, manager, id);   // resized: fit the rows and the badge again
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

    /** Whole days from one "YYYY-MM-DD" to another; MAX_VALUE when either is missing or broken. */
    static int daysBetween(String from, String to) {
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            format.setTimeZone(TimeZone.getTimeZone("UTC"));
            format.setLenient(false);
            return (int) ((format.parse(to).getTime() - format.parse(from).getTime()) / 86_400_000L);
        } catch (Exception e) {
            return Integer.MAX_VALUE;
        }
    }

    /**
     * Rows that fit under the label, title and author at this height (dp): the streak
     * line and the poem lines, ~20dp each, so nothing is cut off. 0 = the launcher didn't say.
     */
    static int rowsThatFit(int heightDp) {
        if (heightDp == 0) return 3;
        // label 15 + title 24 + author 18 + padding 24 = ~81dp
        if (heightDp < 105) return 0;
        if (heightDp < 125) return 1;
        if (heightDp < 145) return 2;
        return 3;
    }

    /** Poem lines left once the streak line (kept first) has its row. */
    static int poemLines(int rows, boolean streakShown) {
        return Math.max(0, Math.min(2, rows - (streakShown ? 1 : 0)));
    }

    /** The next streak badge not earned yet (badges count longest), or 0 when all are. */
    static int nextBadge(int longest) {
        for (int goal : BADGES) if (goal > longest) return goal;
        return 0;
    }

    /**
     * The streak line as { "12일째" or null, the rest }, for a streak the web saved on
     * savedDate, seen on today. The badge part is left out when it doesn't fit widthDp
     * (the widget's width; 0 = unknown).
     */
    static String[] streakLine(String savedDate, String today, int current, int longest,
                               boolean checkedInToday, int widthDp) {
        int gap = daysBetween(savedDate, today);
        // gap 1: read yesterday keeps the streak alive. gap < 0 (phone date moved back): as saved.
        int n = gap <= 0 || (gap == 1 && checkedInToday) ? current : 0;
        boolean readToday = gap <= 0 && checkedInToday;
        String count = n >= 1 ? n + "일째" : null;
        String rest = n >= 1 ? (readToday ? " · 오늘 읽었어요" : " · 오늘 아직이에요") : "오늘 읽고 다시 시작해요";
        int goal = nextBadge(longest);
        if (goal > n) {
            String badge = " · " + goal + "일 배지까지 " + (goal - n) + "일";
            if (widthDp == 0 || fits((count == null ? "" : count) + rest + badge, widthDp - 32)) rest += badge;
        }
        return new String[] {count, rest};
    }

    // shortcut: width guessed from character counts at 12sp and font scale 1; measure with a Paint if devices cut it off.
    static boolean fits(String text, int widthDp) {
        float em = 0;
        for (char c : text.toCharArray()) em += (c >= 0xAC00 && c <= 0xD7A3) ? 1f : 0.55f;
        return em * 12 <= widthDp;
    }

    /** Where the tap goes: that room's poem, or home. roomId goes into the URL, so digits only. */
    static String openPath(String roomId) {
        return roomId != null && roomId.matches("[0-9]{1,18}") ? "/room.html?id=" + roomId : "/index.html";
    }

    private static void draw(Context context, AppWidgetManager manager, int id) {
        SharedPreferences saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String todayDate = seoulDate(System.currentTimeMillis());
        String date = saved.getString("date", null);
        boolean today = todayDate.equals(date);
        // MIN_* are the smaller of the portrait / landscape sizes: fits both.
        Bundle size = manager.getAppWidgetOptions(id);
        int rows = rowsThatFit(size.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT));
        boolean streak = saved.getBoolean("hasStreak", false) && rows >= 1;
        int lines = poemLines(rows, streak);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_poem);
        views.setViewVisibility(R.id.widget_empty, today ? View.GONE : View.VISIBLE);
        show(views, R.id.widget_title, saved.getString("title", ""), today);
        show(views, R.id.widget_author, saved.getString("author", ""), today);
        show(views, R.id.widget_line1, saved.getString("line1", ""), today && lines >= 1);
        show(views, R.id.widget_line2, saved.getString("line2", ""), today && lines >= 2);

        views.setViewVisibility(R.id.widget_streak, streak ? View.VISIBLE : View.GONE);
        if (streak) {
            String[] line = streakLine(date, todayDate, saved.getInt("current", 0), saved.getInt("longest", 0),
                saved.getBoolean("checkedInToday", false), size.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH));
            show(views, R.id.widget_streak_count, line[0] == null ? "" : line[0], true);
            views.setTextViewText(R.id.widget_streak_rest, line[1]);
        }

        Intent open = new Intent(context, MainActivity.class).setAction(ACTION_OPEN)
            .putExtra("roomId", saved.getString("roomId", null));
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        manager.updateAppWidget(id, views);
    }

    private static void show(RemoteViews views, int viewId, String text, boolean visible) {
        views.setTextViewText(viewId, text);
        views.setViewVisibility(viewId, visible && !text.isEmpty() ? View.VISIBLE : View.GONE);
    }
}
