import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";

const NotificationBar = ({ showNotification, distanceToBus, translateY, setShowNotification, personCount, ETA }) => {

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: showNotification ? 0 : 200, // ถ้า showNotification เป็น true -> เลื่อนขึ้น
            duration: 500, 
            useNativeDriver: true 
        }).start();
    }, [showNotification]);

    
    return (
        showNotification && (
            <Animated.View style={[styles.notificationContainer, { transform: [{ translateY }] }]}>
                <View style={styles.topRow}>
                    <Text style={styles.timeText}> {ETA ? `${ETA} นาที` : "กำลังคำนวณ..."}</Text>
                    <Text style={styles.distanceText}> รถเมล์ห่างจากคุณ : {distanceToBus} เมตร</Text>
                </View>
                <Text style={styles.subText}> ผู้โดยสารบนรถ: {personCount}</Text>

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.detailButton} onPress={() => setShowNotification(false)}>
                        <Text style={styles.detailButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        )
    );
};

const styles = StyleSheet.create({
    notificationContainer: {
        position: "absolute",
        bottom: 20,
        left: 15,
        right: 15,
        backgroundColor: "white",
        padding: 20,
        borderRadius: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6,
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    topRow: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    timeText: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#34A853",
        marginBottom: 3,
    },
    distanceText: {
        fontSize: 16,
        color: "#444",
        fontWeight: "500",
    },
    subText: {
        fontSize: 15,
        color: "#666",
        marginTop: 5,
        fontWeight: "400",
    },
    buttonRow: {
        flexDirection: "row",
        marginTop: 12,
        justifyContent: "space-around",
        width: "100%",
    },
    detailButton: {
        flexDirection: "row",
        backgroundColor: "white",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: "#1A73E8",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    detailButtonText: {
        color: "#1A73E8",
        fontSize: 16,
        fontWeight: "bold",
    },
});

export default NotificationBar;