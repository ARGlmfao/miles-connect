package com.phonebridge.android

import android.util.Log
import okhttp3.*
import java.util.concurrent.TimeUnit

class WebSocketManager(private val callback: WebSocketCallback) {

    interface WebSocketCallback {
        fun onStatusChanged(status: String)
        fun onLogReceived(message: String)
        fun onConnected()
        fun onDisconnected()
    }

    private var client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(10, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var isConnected = false
    private var isConnecting = false
    private var currentUrl: String? = null
    private val pendingMessages = java.util.Collections.synchronizedList(mutableListOf<String>())

    fun connect(url: String) {
        if (isConnected || isConnecting) {
            if (currentUrl == url) return
            disconnect()
        }
        
        isConnecting = true
        currentUrl = url
        val request = Request.Builder().url(url).build()
        callback.onStatusChanged("Connecting")
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                isConnecting = false
                callback.onStatusChanged("Connected")
                callback.onConnected()
                Log.d("MilesConnect", "Connected to $url")
                
                // Send pending messages
                synchronized(pendingMessages) {
                    val iterator = pendingMessages.iterator()
                    while (iterator.hasNext()) {
                        val msg = iterator.next()
                        webSocket.send(msg)
                        iterator.remove()
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                // No message handling required for now
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                isConnected = false
                isConnecting = false
                callback.onStatusChanged("Disconnected")
                callback.onDisconnected()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                isConnecting = false
                callback.onStatusChanged("Error")
                Log.e("MilesConnect", "Failure: ${t.message}")
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "User requested disconnect")
        webSocket = null
        isConnected = false
        isConnecting = false
    }

    fun send(message: String): Boolean {
        if (isConnected) {
            return webSocket?.send(message) ?: false
        } else {
            pendingMessages.add(message)
            if (!isConnecting && currentUrl != null) {
                connect(currentUrl!!)
            }
            return true
        }
    }

    fun isConnected(): Boolean = isConnected
}
