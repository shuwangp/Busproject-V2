import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { collection, getDocs } from "firebase/firestore";
import { firestoreDb } from "./Mapbox/firebaseConfig"; 
import PieChartComponent from "./PieChartComponent";

const BusSummary = () => {
  const [summary, setSummary] = useState({});
  const [expandedDay, setExpandedDay] = useState(null);
  const [pieData, setPieData] = useState([]);

  useEffect(() => {
    fetchBusData();
  }, []);

  const fetchBusData = async () => {
    const snapshot = await getDocs(collection(firestoreDb, "busStats"));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const dayMapping = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let tempSummary = {};
    let stopTotals = {};

    data.forEach(bus => {
      const dayOfWeek = dayMapping[new Date(bus.timestamp).getDay()];
      if (!tempSummary[dayOfWeek]) tempSummary[dayOfWeek] = {};

      const stopName = bus.busStopName || "Unknown";
      if (!tempSummary[dayOfWeek][stopName]) {
        tempSummary[dayOfWeek][stopName] = { countIn: 0, countOut: 0, recordCount: 0 };
      }

      tempSummary[dayOfWeek][stopName].countIn += bus.count_in || 0;
      tempSummary[dayOfWeek][stopName].countOut += bus.count_out || 0;
      tempSummary[dayOfWeek][stopName].recordCount += 1;

      if (!stopTotals[stopName]) stopTotals[stopName] = 0;
      stopTotals[stopName] += (bus.count_in || 0);
    });

    const finalSummary = {};
    Object.keys(tempSummary).forEach(day => {
      finalSummary[day] = {};
      Object.keys(tempSummary[day]).forEach(stop => {
        const { countIn, countOut, recordCount } = tempSummary[day][stop];
        const avgTotal = ((countIn + countOut) / (2 * recordCount)).toFixed(2);
        finalSummary[day][stop] = avgTotal;
      });
    });

    const totalAll = Object.values(stopTotals).reduce((a, b) => a + b, 0);
    const pieChartData = Object.entries(stopTotals).map(([stop, value]) => ({
      name: stop,
      value: parseFloat(((value / totalAll) * 100).toFixed(2))
    }));

    setSummary(finalSummary);
    setPieData(pieChartData);
  };

  const toggleDay = useCallback((day) => {
    setExpandedDay(prev => (prev === day ? null : day));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>สรุปค่าเฉลี่ยรวมต่อป้าย</Text>
      <PieChartComponent data={pieData} />

      {Object.keys(summary).map(day => (
        <View key={day} style={styles.dayContainer}>
          <TouchableOpacity onPress={() => toggleDay(day)} style={styles.button}>
            <Text style={styles.buttonText}>{day} {expandedDay === day ? "🔽" : "▶"}</Text>
          </TouchableOpacity>
          {expandedDay === day && (
            <View style={styles.summaryBox}>
              {Object.entries(summary[day]).map(([stop, avgTotal]) => (
                <Text key={stop} style={styles.summaryText}>
                  {stop}: เฉลี่ย {avgTotal} คน
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  dayContainer: { marginTop: 12 },
  button: { backgroundColor: "#ddd", padding: 10, borderRadius: 5 },
  buttonText: { fontSize: 16 },
  summaryBox: { paddingLeft: 10, marginTop: 5 },
  summaryText: { fontSize: 14, marginBottom: 4 }
});

export default BusSummary;
