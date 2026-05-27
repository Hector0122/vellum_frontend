package com.vellumfrontend

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONArray

class VellumWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_CAROUSEL_TICK) {
            val awm = AppWidgetManager.getInstance(context)
            val cn = ComponentName(context, VellumWidgetProvider::class.java)
            for (id in awm.getAppWidgetIds(cn)) advanceCarousel(context, awm, id)
        }
    }

    override fun onUpdate(context: Context, awm: AppWidgetManager, ids: IntArray) {
        for (id in ids) renderWidget(context, awm, id)
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        for (id in ids) {
            p.remove("${K_JSON}_$id").remove("${K_BID}_$id")
                .remove("${K_TITLE}_$id").remove("${K_IDX}_$id")
            stopCarousel(context, id)
        }
        p.apply()
    }

    companion object {
        const val PREFS = "VellumWidgetPrefs"
        const val K_JSON = "hj"
        const val K_BID = "bi"
        const val K_TITLE = "bt"
        const val K_IDX = "ix"
        const val ACTION_CAROUSEL_TICK = "com.vellumfrontend.CAROUSEL_TICK"
        const val INTERVAL = 5000L

        fun pushWidgetData(ctx: Context, json: String, bookId: String, title: String) {
            val awm = AppWidgetManager.getInstance(ctx)
            val ids = awm.getAppWidgetIds(ComponentName(ctx, VellumWidgetProvider::class.java))
            if (ids.isEmpty()) return
            for (id in ids) {
                ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString("${K_JSON}_$id", json)
                    .putString("${K_BID}_$id", bookId)
                    .putString("${K_TITLE}_$id", title)
                    .putInt("${K_IDX}_$id", 0).apply()
                stopCarousel(ctx, id)
                renderWidget(ctx, awm, id)
                startCarousel(ctx, id)
            }
        }

        fun renderWidget(ctx: Context, awm: AppWidgetManager, id: Int) {
            val rv = RemoteViews(ctx.packageName, R.layout.vellum_widget)
            val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val json = p.getString("${K_JSON}_$id", null)
            val bookId = p.getString("${K_BID}_$id", null)
            val title = p.getString("${K_TITLE}_$id", null)
            val idx = p.getInt("${K_IDX}_$id", 0)

            if (json != null) {
                try {
                    val arr = JSONArray(json)
                    val n = arr.length()
                    if (n > 0) {
                        val i = idx % n
                        rv.setTextViewText(R.id.widget_title, title ?: "")
                        rv.setTextViewText(R.id.widget_highlight, "\u201C${arr.getJSONObject(i).getString("text")}\u201D")
                        rv.setViewVisibility(R.id.widget_highlight, android.view.View.VISIBLE)
                        rv.setViewVisibility(R.id.widget_author, android.view.View.GONE)
                        p.edit().putInt("${K_IDX}_$id", i).apply()
                    } else {
                        showPlaceholder(rv)
                    }
                } catch (_: Exception) {
                    showPlaceholder(rv)
                }
            } else {
                showPlaceholder(rv)
            }

            val uri = Uri.parse("vellum://reader/${bookId ?: ""}")
            val tap = Intent(Intent.ACTION_VIEW, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pi = PendingIntent.getActivity(ctx, id, tap,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            rv.setOnClickPendingIntent(R.id.widget_title, pi)
            rv.setOnClickPendingIntent(R.id.widget_highlight, pi)

            awm.updateAppWidget(id, rv)
        }

        private fun showPlaceholder(rv: RemoteViews) {
            rv.setTextViewText(R.id.widget_title, "Vellum")
            rv.setTextViewText(R.id.widget_author, "Open app to configure")
            rv.setViewVisibility(R.id.widget_author, android.view.View.VISIBLE)
            rv.setViewVisibility(R.id.widget_highlight, android.view.View.GONE)
        }

        fun advanceCarousel(ctx: Context, awm: AppWidgetManager, id: Int) {
            val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val json = p.getString("${K_JSON}_$id", null) ?: return
            try {
                val arr = JSONArray(json)
                if (arr.length() <= 1) return
                val idx = p.getInt("${K_IDX}_$id", 0)
                p.edit().putInt("${K_IDX}_$id", (idx + 1) % arr.length()).apply()
                renderWidget(ctx, awm, id)
            } catch (_: Exception) {}
        }

        private fun startCarousel(ctx: Context, id: Int) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val i = Intent(ctx, VellumWidgetProvider::class.java).apply { action = ACTION_CAROUSEL_TICK }
            val pi = PendingIntent.getBroadcast(ctx, id + 1000, i,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) am.setRepeating(AlarmManager.ELAPSED_REALTIME,
                    android.os.SystemClock.elapsedRealtime() + INTERVAL, INTERVAL, pi)
            } else {
                @Suppress("DEPRECATION")
                am.setRepeating(AlarmManager.ELAPSED_REALTIME,
                    android.os.SystemClock.elapsedRealtime() + INTERVAL, INTERVAL, pi)
            }
        }

        private fun stopCarousel(ctx: Context, id: Int) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val i = Intent(ctx, VellumWidgetProvider::class.java).apply { action = ACTION_CAROUSEL_TICK }
            val pi = PendingIntent.getBroadcast(ctx, id + 1000, i,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            am.cancel(pi)
        }
    }
}
