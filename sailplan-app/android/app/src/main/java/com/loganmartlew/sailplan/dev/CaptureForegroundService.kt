package com.loganmartlew.sailplan.dev

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class CaptureForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val sessionId = intent?.getIntExtra(EXTRA_SESSION_ID, 0) ?: 0
    if (sessionId <= 0) {
      stopSelf(startId)
      return START_NOT_STICKY
    }

    val notification = notification(sessionId)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun notification(sessionId: Int): Notification {
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "NMEA recording",
          NotificationManager.IMPORTANCE_LOW,
        ).apply {
          description = "Status while SailPlan records plotter data"
          setShowBadge(false)
        },
      )
    }

    val stopIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("sailplan://capture/stop?sessionId=$sessionId"),
      this,
      MainActivity::class.java,
    ).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    val stopPendingIntent = PendingIntent.getActivity(this, sessionId, stopIntent, pendingFlags)

    return Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Recording this course")
      .setContentText("SailPlan is recording NMEA data")
      .setCategory(Notification.CATEGORY_SERVICE)
      .setOngoing(true)
      .addAction(Notification.Action.Builder(null, "Stop", stopPendingIntent).build())
      .build()
  }

  companion object {
    const val EXTRA_SESSION_ID = "captureSessionId"
    const val CHANNEL_ID = "capture-recording"
    const val NOTIFICATION_ID = 4104
  }
}

@ReactModule(name = CaptureForegroundServiceModule.NAME)
class CaptureForegroundServiceModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  override fun getName() = NAME

  @ReactMethod
  fun start(sessionId: Double, promise: Promise) {
    val intent = Intent(context, CaptureForegroundService::class.java).putExtra(
      CaptureForegroundService.EXTRA_SESSION_ID,
      sessionId.toInt(),
    )
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("CAPTURE_SERVICE_START_FAILED", error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    context.stopService(Intent(context, CaptureForegroundService::class.java))
    promise.resolve(null)
  }

  companion object {
    const val NAME = "CaptureForegroundService"
  }
}

class CaptureForegroundServicePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == CaptureForegroundServiceModule.NAME) {
      CaptureForegroundServiceModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      CaptureForegroundServiceModule.NAME to ReactModuleInfo(
        CaptureForegroundServiceModule.NAME,
        CaptureForegroundServiceModule::class.java.name,
        false,
        false,
        false,
        false,
      ),
    )
  }
}
