import React from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";

const NotificationBar = ({ showNotification, distanceToBus, translateY, setShowNotification }) => {
    return (
        showNotification && (
            <Animated.View style={[styles.notificationContainer, { transform: [{ translateY }] }]}>
                <Text style={styles.notificationText}>รถเมล์อยู่ห่างจากคุณ {distanceToBus ? `${distanceToBus} เมตร` : "กำลังคำนวณ..."}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowNotification(false)}>
                    <Text style={styles.closeButtonText}>ปิด</Text>
                </TouchableOpacity>
            </Animated.View>
        )
    );
};

const styles = StyleSheet.create({
    notificationContainer: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: "rgba(255, 254, 250, 0.95)", 
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    notificationText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    closeButton: {
        marginTop: 10,
        backgroundColor: "#FF4500",
        paddingVertical: 5,
        paddingHorizontal: 15,
        borderRadius: 5,
    },
    closeButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
    },
});

export default NotificationBar;
