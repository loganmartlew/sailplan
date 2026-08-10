// THROWAWAY — ticket `13` device spike only. Not linked from anywhere in the
// app; reach it with:
//
//   adb shell am start -a android.intent.action.VIEW -d "sailplan://spike"
//
// Delete this file, `spike/`, `plugins/withNmeaSpikeForegroundService.js` and
// the two spike dependencies when the ticket closes.

import * as React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Paths } from 'expo-file-system';
import { snapshot, subscribe, type SpikeSnapshot } from '~/spike/spikeCapture';
import {
  requestNotificationPermission,
  startSpike,
  stopSpike,
} from '~/spike/spikeService';
import { spikeDb } from '~/spike/spikeDb';

const HOST_DEFAULT = '10.42.0.1'; // nmea-sim/hotspot.sh
const PORT_DEFAULT = '10110'; // the Zeus's own port, per `01`

export default function SpikeScreen() {
  const [host, setHost] = React.useState(HOST_DEFAULT);
  const [port, setPort] = React.useState(PORT_DEFAULT);
  const [note, setNote] = React.useState('');
  const [wifi, setWifi] = React.useState(true);
  const [fastForward, setFastForward] = React.useState(false);
  const [snap, setSnap] = React.useState<SpikeSnapshot>(snapshot);
  const [summary, setSummary] = React.useState<string>('');

  React.useEffect(() => {
    const unsubscribe = subscribe(setSnap);
    return () => {
      unsubscribe();
    };
  }, []);

  // The snapshot is pushed on socket activity, which stops being delivered to
  // a screen that is not mounted. This keeps the numbers moving while the user
  // is actually looking at them, and is deliberately UI-only — nothing on the
  // capture path depends on it.
  React.useEffect(() => {
    const id = setInterval(() => setSnap(snapshot()), 500);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    await requestNotificationPermission();
    await startSpike({
      host: host.trim(),
      port: Number(port),
      wifiInterface: wifi,
      coalesceMs: fastForward ? 0 : 250,
      note: note.trim() || null,
    });
  };

  const readSummary = () => {
    const db = spikeDb();
    const run = db.getFirstSync<{
      id: number;
      started_at: number;
      ended_at: number | null;
      wifi_interface: number;
    }>(`SELECT * FROM spike_run ORDER BY id DESC LIMIT 1`);
    if (!run) {
      setSummary('no runs yet');
      return;
    }
    const stats = db.getFirstSync<{
      rows: number;
      max_gap: number;
      first_ts: number;
      last_ts: number;
    }>(
      `SELECT COUNT(*) AS rows, MAX(gap_ms) AS max_gap,
              MIN(ts) AS first_ts, MAX(ts) AS last_ts
       FROM spike_sample WHERE run_id = ?`,
      [run.id]
    );
    const holes = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM spike_sample WHERE run_id = ? AND gap_ms > 3000`,
      [run.id]
    );
    const stalls = db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM spike_event WHERE run_id = ? AND kind = 'timer_stall'`,
      [run.id]
    );
    const wall = stats?.last_ts
      ? Math.round((stats.last_ts - stats.first_ts) / 1000)
      : 0;
    setSummary(
      [
        `run ${run.id}${run.ended_at ? '' : ' (open)'} wifi=${run.wifi_interface}`,
        `rows ${stats?.rows ?? 0} over ${wall}s`,
        `max gap ${stats?.max_gap ?? 0} ms · holes>3s ${holes?.n ?? 0}`,
        `timer stalls ${stalls?.n ?? 0}`,
      ].join('\n')
    );
  };

  const share = async () => {
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(`${Paths.document.uri}SQLite/spike.db`);
  };

  const running = snap.running;
  const uptime = snap.startedAt
    ? Math.round((Date.now() - snap.startedAt) / 1000)
    : 0;
  const sinceData = snap.lastDataAt
    ? Math.round((Date.now() - snap.lastDataAt) / 1000)
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0b0f14' }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
        NMEA capture spike · ticket 13
      </Text>

      <Field label='host' value={host} onChange={setHost} editable={!running} />
      <Field
        label='port'
        value={port}
        onChange={setPort}
        editable={!running}
        keyboard='numeric'
      />
      <Field label='note' value={note} onChange={setNote} editable={!running} />

      <Pressable onPress={() => !running && setWifi((w) => !w)} style={row}>
        <Text style={{ color: '#9fb3c8' }}>interface: 'wifi'</Text>
        <Text style={{ color: wifi ? '#5ee08a' : '#ff8b6b', fontWeight: '700' }}>
          {wifi ? 'ON (pinned to WiFi)' : 'OFF (item 5 control case)'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => !running && setFastForward((f) => !f)}
        style={row}
      >
        <Text style={{ color: '#9fb3c8' }}>coalesce window</Text>
        <Text
          style={{
            color: fastForward ? '#ffd166' : '#5ee08a',
            fontWeight: '700',
          }}
        >
          {fastForward ? '0 ms (Tier A, 60× replay)' : '250 ms (real time)'}
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label={running ? 'running…' : 'Start'} onPress={start} disabled={running} />
        <Button label='Stop' onPress={stopSpike} disabled={!running} />
      </View>

      <View style={{ height: 1, backgroundColor: '#22303c', marginVertical: 4 }} />

      <Stat k='socket' v={snap.socket} />
      <Stat k='uptime' v={`${uptime}s`} />
      <Stat k='bytes' v={String(snap.bytes)} />
      <Stat k='lines' v={String(snap.lines)} />
      <Stat k='bad checksum' v={String(snap.badChecksum)} />
      <Stat k='samples emitted' v={String(snap.samples)} />
      <Stat k='rows written' v={String(snap.rowsWritten)} />
      <Stat k='raw log bytes' v={String(snap.rawBytes)} />
      <Stat k='max sample gap' v={`${snap.maxGapMs} ms`} />
      <Stat k='timer ticks' v={String(snap.timerTicks)} />
      <Stat k='max timer stall' v={`${snap.maxTimerStallMs} ms`} />
      <Stat k='since last data' v={sinceData === null ? '—' : `${sinceData}s`} />
      <Stat k='last error' v={snap.lastError ?? '—'} />
      <Text style={{ color: '#5f7d95', fontFamily: 'monospace', fontSize: 11 }}>
        {snap.lastLine ?? ''}
      </Text>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label='Summary' onPress={readSummary} />
        <Button label='Share db' onPress={share} />
      </View>
      {summary ? (
        <Text
          style={{ color: '#cfe3f5', fontFamily: 'monospace', fontSize: 12 }}
        >
          {summary}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const row: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 6,
};

function Field({
  label,
  value,
  onChange,
  editable,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  keyboard?: 'numeric';
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: '#9fb3c8', fontSize: 12 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        keyboardType={keyboard}
        autoCapitalize='none'
        autoCorrect={false}
        style={{
          color: '#fff',
          borderWidth: 1,
          borderColor: '#22303c',
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      />
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: disabled ? '#1b2732' : '#2563eb',
      }}
    >
      <Text style={{ color: disabled ? '#5f7d95' : '#fff', fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <View style={row}>
      <Text style={{ color: '#9fb3c8' }}>{k}</Text>
      <Text style={{ color: '#fff', fontFamily: 'monospace' }}>{v}</Text>
    </View>
  );
}
