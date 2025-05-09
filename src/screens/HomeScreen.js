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
        disabled={isLoading}
      >
        <Image source={require("../../assets/bus.png")} style={styles.busIcon} />
        <Text style={styles.buttonText}>ติดตามรถโดยสาร</Text>
      </TouchableOpacity>

      {/* ปุ่มดูตารางสถิติ */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("BusSummary")}
        disabled={isLoading}
      >
        <Image source={require("../../assets/data.png")} style={styles.dataIcon} />
        <Text style={styles.buttonText}>ดูตารางสถิติ</Text>
      </TouchableOpacity>

      {/* แสดง ActivityIndicator ขณะโหลด */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5E17EB" />
          <Text style={styles.loadingText}></Text>
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
    marginVertical: 40,
  },
  busIcon: {
    width: 400,
    height: 150,
    resizeMode: "contain",
    tintColor: "#5E17EB",
  },
  dataIcon: {
    width: 80,
    height: 200,
    resizeMode: "contain",
    tintColor: "#5E17EB",
  },
  buttonText: {
    fontSize: 20,
    color: "#000",
    fontWeight: "bold",
    marginTop: 5,
    paddingLeft: 32,
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
