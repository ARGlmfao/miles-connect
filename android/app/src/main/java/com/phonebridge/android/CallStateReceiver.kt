package com.phonebridge.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import com.google.gson.Gson
import android.provider.ContactsContract
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.telephony.PhoneNumberUtils

class CallStateReceiver : BroadcastReceiver() {
    companion object {
        private var lastSentTime = 0L
        private var lastNormalizedNumber = ""
        private val handler = Handler(Looper.getMainLooper())
        private var pendingUnknownRunnable: Runnable? = null
        private var pendingUnknownResult: PendingResult? = null

        fun getContactName(context: Context, phoneNumber: String?): String? {
            if (phoneNumber.isNullOrEmpty() || phoneNumber == "Unknown") return null
            
            if (context.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return null
            }

            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
            val projection = arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME)
            
            return try {
                context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.PhoneLookup.DISPLAY_NAME))
                    } else {
                        null
                    }
                }
            } catch (e: Exception) {
                Log.e("CallStateReceiver", "Error looking up contact: ${e.message}")
                null
            }
        }
        
        private fun normalizeNumber(number: String?): String {
            if (number.isNullOrEmpty() || number == "Unknown") return "Unknown"
            return PhoneNumberUtils.normalizeNumber(number)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val sharedPrefs = context.getSharedPreferences("MilesConnectPrefs", Context.MODE_PRIVATE)
        if (!sharedPrefs.getBoolean("send_calls", true)) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        
        // Requirement 10: Only keep incoming ringing call alerts.
        if (state != TelephonyManager.EXTRA_STATE_RINGING) {
            cancelPendingUnknown()
            return
        }

        val rawNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
        val normalizedNumber = normalizeNumber(rawNumber)
        val currentTime = System.currentTimeMillis()

        // Requirement 3 & 8: Dedupe by normalized phone number within 20 seconds
        if ((currentTime - lastSentTime) < 20000) {
            if (normalizedNumber == lastNormalizedNumber) return
            // If we already sent a real number call, ignore subsequent "Unknown" for the same window
            if (normalizedNumber == "Unknown") return
        }

        if (normalizedNumber == "Unknown") {
            // Requirement 1 & 7: Wait briefly (300ms) to resolve "Unknown" to a real number
            cancelPendingUnknown()
            val result = goAsync()
            val runnable = Runnable {
                sendCallEvent(context, "Unknown", "Unknown", currentTime)
                lastSentTime = currentTime
                lastNormalizedNumber = "Unknown"
                result.finish()
                if (pendingUnknownResult == result) {
                    pendingUnknownResult = null
                    pendingUnknownRunnable = null
                }
            }
            pendingUnknownRunnable = runnable
            pendingUnknownResult = result
            handler.postDelayed(runnable, 300)
        } else {
            // Requirement 7: Cancel any pending Unknown event if a real number arrived
            cancelPendingUnknown()
            
            // Requirement 2, 4, 5: Resolve contact name or use number as name
            val contactName = getContactName(context, rawNumber) ?: rawNumber ?: "Unknown"
            sendCallEvent(context, contactName, rawNumber ?: "Unknown", currentTime)
            
            lastSentTime = currentTime
            lastNormalizedNumber = normalizedNumber
        }
    }

    private fun cancelPendingUnknown() {
        pendingUnknownRunnable?.let { handler.removeCallbacks(it) }
        pendingUnknownResult?.finish()
        pendingUnknownRunnable = null
        pendingUnknownResult = null
    }

    private fun sendCallEvent(context: Context, name: String, number: String, time: Long) {
        val event = mapOf(
            "type" to "call",
            "name" to name,
            "number" to number,
            "state" to "ringing",
            "time" to time
        )
        
        val json = Gson().toJson(event)
        PhoneNotificationListenerService.webSocketManager?.send(json)
        Log.d("MilesConnect", "Incoming call event sent: $name ($number)")
    }
}
