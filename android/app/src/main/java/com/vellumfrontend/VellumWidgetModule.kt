package com.vellumfrontend

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VellumWidgetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VellumWidget"

    @ReactMethod
    fun pushWidgetData(
        highlightsJson: String,
        bookId: String,
        bookTitle: String,
        promise: Promise,
    ) {
        try {
            VellumWidgetProvider.pushWidgetData(
                reactApplicationContext,
                highlightsJson,
                bookId,
                bookTitle,
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasWidget(promise: Promise) {
        try {
            val appWidgetManager = AppWidgetManager.getInstance(reactApplicationContext)
            val componentName = ComponentName(reactApplicationContext, VellumWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            promise.resolve(appWidgetIds.isNotEmpty())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getWidgetBookId(promise: Promise) {
        try {
            val appWidgetManager = AppWidgetManager.getInstance(reactApplicationContext)
            val componentName = ComponentName(reactApplicationContext, VellumWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            if (appWidgetIds.isEmpty()) {
                promise.resolve(null)
                return
            }

            val prefs = reactApplicationContext.getSharedPreferences(
                VellumWidgetProvider.PREFS, 0
            )
            val bookId = prefs.getString(
                "${VellumWidgetProvider.K_BID}_${appWidgetIds[0]}", null
            )
            promise.resolve(bookId)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
