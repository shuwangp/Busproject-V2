import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from "react-native";

export default function HomeScreen({ navigation }) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleNavigateToMapbox = () => {
    setIsLoading(true); 
    setTimeout(() => {
      setIsLoading(false); 
      navigation.navigate("MapboxScreen"); 
    }, 2000); 
  };

  return (
    <View style={styles.container}>
      {/* ปุ่มติดตามรถโดยสาร */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleNavigateToMapbox}
        disabled={isLoading} // ปิดการใช้งานปุ่มขณะโหลด
      >
        <Image source={require("../../assets/bus.png")} style={styles.icon} />
        <Text style={styles.buttonText}>ติดตามรถโดยสาร</Text>
      </TouchableOpacity>

      {/* ปุ่มดูตารางสถิติ */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("StatisticsScreen")}
        disabled={isLoading} // ปิดการใช้งานปุ่มขณะโหลด
      >
        <Image source={require("../../assets/bus.png")} style={styles.icon} />
        <Text style={styles.buttonText}>ดูตารางสถิติ</Text>
      </TouchableOpacity>

      {/* แสดง ActivityIndicator ขณะโหลด */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5E17EB" />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    alignItems: "center",
    marginVertical: 80, // เว้นระยะห่างระหว่างปุ่มทั้งสองให้เท่ากัน
  },
  icon: {
    width: 400, // ปรับขนาดไอคอนให้เท่ากัน
    height: 200,
    resizeMode: "contain",
    tintColor: "#5E17EB",
  },
  buttonText: {
    fontSize: 20,
    color: "#000",
    fontWeight: "bold",
    marginTop: 1,
    paddingLeft: 27, // ขยับตัวอักษรไปทางขวา 20px
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#5E17EB",
  },
});