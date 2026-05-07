package com.phonebridge.android

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.gson.Gson
import com.phonebridge.android.databinding.ActivityMainBinding
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity(), WebSocketManager.WebSocketCallback {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sharedPrefs: SharedPreferences
    private var webSocketManager: WebSocketManager? = null
    private val discoveryExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sharedPrefs = getSharedPreferences("MilesConnectPrefs", Context.MODE_PRIVATE)
        
        // Migrate old prefs if needed (simple check)
        val oldPrefs = getSharedPreferences("PhoneBridgePrefs", Context.MODE_PRIVATE)
        if (oldPrefs.all.isNotEmpty() && sharedPrefs.all.isEmpty()) {
            val editor = sharedPrefs.edit()
            oldPrefs.all.forEach { (key, value) ->
                when (value) {
                    is String -> editor.putString(key, value)
                    is Boolean -> editor.putBoolean(key, value)
                    is Int -> editor.putInt(key, value)
                    is Long -> editor.putLong(key, value)
                    is Float -> editor.putFloat(key, value)
                }
            }
            editor.apply()
            oldPrefs.edit().clear().apply()
        }

        webSocketManager = WebSocketManager(this)
        PhoneNotificationListenerService.webSocketManager = webSocketManager

        setupUI()
        loadSettings()
        checkPermissions()
        
        // Auto-reconnect on startup if URL exists
        val savedUrl = sharedPrefs.getString("ws_url", "")
        if (!savedUrl.isNullOrEmpty()) {
            webSocketManager?.connect(savedUrl)
        }
    }

    private fun setupUI() {
        // Pairing Connection
        binding.btnConnectWithCode.setOnClickListener {
            val code = binding.etPairingCode.text.toString().uppercase()
            if (code.isNotEmpty()) {
                startDiscovery(code)
            } else {
                Toast.makeText(this, "Please enter pairing code", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnAdvancedToggle.setOnClickListener {
            binding.llAdvancedConnection.visibility = if (binding.llAdvancedConnection.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }

        binding.btnConnectManual.setOnClickListener {
            val url = binding.etUrl.text.toString()
            if (url.isNotEmpty()) {
                webSocketManager?.connect(url)
            } else {
                Toast.makeText(this, "Please enter a WebSocket URL", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnDisconnect.setOnClickListener {
            webSocketManager?.disconnect()
        }

        // Permissions
        binding.btnEnableNotif.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        binding.btnEnablePhone.setOnClickListener {
            requestPermissions(arrayOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG), 101)
        }

        binding.btnEnableContacts.setOnClickListener {
            requestPermissions(arrayOf(Manifest.permission.READ_CONTACTS), 102)
        }

        // Features
        binding.swSendNotifications.setOnCheckedChangeListener { _, isChecked ->
            sharedPrefs.edit().putBoolean("send_notifications", isChecked).apply()
        }
        binding.swSendCalls.setOnCheckedChangeListener { _, isChecked ->
            sharedPrefs.edit().putBoolean("send_calls", isChecked).apply()
        }

        // URL persistence for manual entry
        binding.etUrl.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) {
                sharedPrefs.edit().putString("ws_url", s.toString()).apply()
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })
    }

    private fun loadSettings() {
        binding.etUrl.setText(sharedPrefs.getString("ws_url", ""))
        binding.swSendNotifications.isChecked = sharedPrefs.getBoolean("send_notifications", true)
        binding.swSendCalls.isChecked = sharedPrefs.getBoolean("send_calls", true)
    }

    private fun checkPermissions() {
        // Notification Access
        val isNotifEnabled = isNotificationServiceEnabled()
        binding.tvNotifPermissionStatus.text = "Notification Access: ${if (isNotifEnabled) "Enabled" else "Disabled"}"
        binding.btnEnableNotif.visibility = if (isNotifEnabled) View.GONE else View.VISIBLE

        // Phone
        val isPhoneEnabled = checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        binding.tvPhonePermissionStatus.text = "Phone Permission: ${if (isPhoneEnabled) "Enabled" else "Disabled"}"
        binding.btnEnablePhone.visibility = if (isPhoneEnabled) View.GONE else View.VISIBLE

        // Contacts
        val isContactsEnabled = checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        binding.tvContactsPermissionStatus.text = "Contacts Permission: ${if (isContactsEnabled) "Enabled" else "Disabled"}"
        binding.btnEnableContacts.visibility = if (isContactsEnabled) View.GONE else View.VISIBLE
    }

    private fun isNotificationServiceEnabled(): Boolean {
        val pkgName = packageName
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        if (!TextUtils.isEmpty(flat)) {
            val names = flat.split(":")
            for (name in names) {
                val cn = ComponentName.unflattenFromString(name)
                if (cn != null && TextUtils.equals(pkgName, cn.packageName)) {
                    return true
                }
            }
        }
        return false
    }

    private fun startDiscovery(targetCode: String) {
        binding.tvStatus.text = "Searching for PC..."
        binding.tvStatus.setTextColor(getColor(android.R.color.darker_gray))
        
        discoveryExecutor.execute {
            var socket: DatagramSocket? = null
            try {
                socket = DatagramSocket(8788)
                socket.soTimeout = 10000 // 10 seconds timeout
                
                val buffer = ByteArray(1024)
                val packet = DatagramPacket(buffer, buffer.size)
                
                val startTime = System.currentTimeMillis()
                while (System.currentTimeMillis() - startTime < 10000) {
                    try {
                        socket.receive(packet)
                        val data = String(packet.data, 0, packet.length)
                        val discovery = Gson().fromJson(data, DiscoveryPacket::class.java)
                        
                        if (discovery.type == "milesconnect_discovery" || discovery.type == "phonebridge_discovery" && discovery.code == targetCode) {
                            runOnUiThread {
                                binding.tvStatus.text = "PC Found: ${discovery.deviceName}"
                                webSocketManager?.connect(discovery.wsUrl)
                                sharedPrefs.edit().putString("ws_url", discovery.wsUrl).apply()
                                binding.etUrl.setText(discovery.wsUrl)
                            }
                            return@execute
                        }
                    } catch (e: Exception) {
                        // Timeout or other error
                    }
                }
                
                runOnUiThread {
                    binding.tvStatus.text = "PC not found. Make sure both devices are on the same Wi-Fi."
                    binding.tvStatus.setTextColor(getColor(android.R.color.holo_red_dark))
                }
            } catch (e: Exception) {
                runOnUiThread {
                    binding.tvStatus.text = "Discovery Error: ${e.message}"
                }
            } finally {
                socket?.close()
            }
        }
    }

    data class DiscoveryPacket(
        val type: String,
        val code: String,
        val wsUrl: String,
        val deviceName: String
    )

    // WebSocket Callbacks
    override fun onStatusChanged(status: String) {
        runOnUiThread {
            binding.tvStatus.text = status
            when {
                status.contains("Connected", true) -> binding.tvStatus.setTextColor(getColor(android.R.color.holo_green_dark))
                status.contains("Error", true) -> {
                    binding.tvStatus.text = "PC not reachable. Check connection."
                    binding.tvStatus.setTextColor(getColor(android.R.color.holo_red_dark))
                }
                else -> binding.tvStatus.setTextColor(getColor(android.R.color.darker_gray))
            }
        }
    }

    override fun onLogReceived(message: String) {
        // No visible debug panel in production
        Log.d("MilesConnect", message)
    }

    override fun onConnected() {}
    override fun onDisconnected() {}

    override fun onResume() {
        super.onResume()
        checkPermissions()
        if (webSocketManager?.isConnected() == false) {
            val savedUrl = sharedPrefs.getString("ws_url", "")
            if (!savedUrl.isNullOrEmpty()) {
                binding.tvStatus.text = "Not connected"
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        checkPermissions()
    }
}
