package com.phonebridge.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.google.gson.Gson
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class PhoneNotificationListenerService : NotificationListenerService() {

    private val gson = Gson()
    private val recentNotifications = mutableMapOf<String, Long>()
    
    companion object {
        private const val CHANNEL_ID = "MilesConnectService"
        private const val NOTIFICATION_ID = 1001
        private var instance: PhoneNotificationListenerService? = null
        var webSocketManager: WebSocketManager? = null

        fun sendTestNotification(context: Context) {
            val testEvent = mapOf(
                "type" to "notification",
                "app" to "Miles Connect",
                "title" to "Test Notification",
                "text" to "Android to PC connection works",
                "time" to System.currentTimeMillis()
            )
            val json = Gson().toJson(testEvent)
            webSocketManager?.send(json)
        }
    }

    override fun onBind(intent: Intent?): IBinder? {
        instance = this
        return super.onBind(intent)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        
        startForegroundService()
        
        val sharedPrefs = getSharedPreferences("MilesConnectPrefs", Context.MODE_PRIVATE)
        val url = sharedPrefs.getString("ws_url", "")
        
        if (webSocketManager == null) {
            webSocketManager = WebSocketManager(object : WebSocketManager.WebSocketCallback {
                override fun onStatusChanged(status: String) {
                    Log.d("MilesConnectService", "Status: $status")
                }
                override fun onLogReceived(message: String) {
                    // Minimized logs for production
                }
                override fun onConnected() {}
                override fun onDisconnected() {}
            })
            
            if (!url.isNullOrEmpty()) {
                webSocketManager?.connect(url)
            }
        }
    }

    private fun startForegroundService() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Miles Connect Service",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)
        }

        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Miles Connect")
            .setContentText("Miles Connect running")
            .setSmallIcon(R.drawable.ic_launcher_foreground) // Use existing foreground as icon
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val notification = sbn.notification
        val extras = notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val isGroupSummary = (notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0

        // Skip our own foreground notification
        if (sbn.packageName == packageName) return

        val sharedPrefs = getSharedPreferences("MilesConnectPrefs", Context.MODE_PRIVATE)
        
        // Feature toggle check
        val sendNotifications = sharedPrefs.getBoolean("send_notifications", true)
        if (!sendNotifications) return

        val hideOngoing = sharedPrefs.getBoolean("hide_ongoing", true)
        val blockedPackages = sharedPrefs.getString("blocked_packages", "")?.split(",")?.map { it.trim() } ?: emptyList()

        if (sbn.isOngoing && hideOngoing) return
        if (blockedPackages.contains(sbn.packageName)) return

        // 1. Ignore group summaries
        if (isGroupSummary) return

        // 6. Ignore empty or useless
        if (title.isEmpty() && text.isEmpty()) return

        // 2. Ignore summary-style counter notifications
        val lowerText = text.lowercase()
        val lowerTitle = title.lowercase()
        if (lowerText.contains("new messages") || lowerText.contains("messages from") ||
            lowerTitle.contains("new messages") || lowerTitle.contains("messages from")) {
            return
        }

        // 3. Strengthened deduplication (normalized packageName + title + text)
        val normalizedPackage = sbn.packageName.lowercase().trim()
        val normalizedTitle = title.lowercase().trim().replace(Regex("\\s+"), " ")
        val normalizedText = text.lowercase().trim().replace(Regex("\\s+"), " ")
        val dedupeKey = "$normalizedPackage|$normalizedTitle|$normalizedText"
        
        val currentTime = System.currentTimeMillis()

        // Remove old entries (> 20s as requested for calls, using same for notifs)
        recentNotifications.entries.removeAll { currentTime - it.value > 20000 }

        if (recentNotifications.containsKey(dedupeKey)) return
        recentNotifications[dedupeKey] = currentTime
        
        val appLabel = try {
            packageManager.getApplicationLabel(
                packageManager.getApplicationInfo(sbn.packageName, 0)
            ).toString()
        } catch (e: Exception) {
            sbn.packageName
        }

        val event = mapOf(
            "type" to "notification",
            "app" to appLabel,
            "package" to sbn.packageName,
            "title" to title,
            "text" to text,
            "time" to sbn.postTime
        )

        val json = gson.toJson(event)
        webSocketManager?.send(json)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
    }
}

