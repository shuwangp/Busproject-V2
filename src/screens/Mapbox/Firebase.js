import { getDatabase, ref, onValue } from "firebase/database";
import { app } from "./firebaseConfig"; 

// สร้าง Firebase Database instance
const db = getDatabase(app);

export const getBusLocation = (busIds, setBusLocations) => {
    const busLocations = {};

    const unsubscribeFunctions = [];

    busIds.forEach((busId) => {
        const busRef = ref(db, `bus_data/${busId}`); 

        // ติดตามการเปลี่ยนแปลงข้อมูล
        const unsubscribe = onValue(busRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                busLocations[busId] = {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    personCount: data.personCount ?? 0,
                    color: busId === "983c87a389de9218" ? "#0a8f08" : "#e51c23",
                };
                setBusLocations({ ...busLocations }); // อัปเดต state
            } else {
                console.log(`⚠️ ไม่มีข้อมูลตำแหน่งรถเมล์สำหรับ ID: ${busId} ใน Firebase!`);
                busLocations[busId] = null;
                setBusLocations({ ...busLocations }); // อัปเดต state
            }
        }, (error) => {
            console.error(`❌ ดึงข้อมูล Firebase สำหรับ ID: ${busId} ไม่ได้:`, error);
        });

        unsubscribeFunctions.push(unsubscribe);
    });

    return () => {
        unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
};