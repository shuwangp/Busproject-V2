import { ref, onValue } from "firebase/database";
import { db } from "./firebaseConfig";

export const getBusLocation = (setBusLocation) => {
    const busRef = ref(db, "bus_data/latest"); 

    const unsubscribe = onValue(busRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            setBusLocation({
                latitude: data.latitude,
                longitude: data.longitude,
                personCount: data.personCount, 
            });
        } else {
            console.log("⚠️ ไม่มีข้อมูลตำแหน่งรถเมล์ใน Firebase!");
            setBusLocation(null);
        }
    }, (error) => {
        console.error("❌ ดึงข้อมูล Firebase ไม่ได้:", error);
    });

    return unsubscribe;
};
    