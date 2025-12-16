import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    GoogleSignin,
} from "@react-native-google-signin/google-signin";

import {
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

export default function Layout() {
    const router = useRouter();
    const [userdata, setUserdata] = useState<any>(null);
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem("user").then((data) => {
            if (data) setUserdata(JSON.parse(data));
        });
    }, []);

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: "#157811" },
                headerTitleAlign: "center",
                headerTintColor: "#fff",
                headerTitleStyle: { fontWeight: "bold", fontSize: 25 },
                headerLeft: () => (
                    <View>
                        <TouchableOpacity onPress={() => setMenuVisible(true)}>
                            <Image
                                source={{
                                    uri:
                                        userdata?.picture ??
                                        "https://i.pravatar.cc/40",
                                }}
                                style={{
                                    width: 37,
                                    height: 37,
                                }}
                            />
                        </TouchableOpacity>

                        <Modal
                            transparent
                            visible={menuVisible}
                            animationType="fade"
                            onRequestClose={() => setMenuVisible(false)}
                        >
                            <TouchableWithoutFeedback
                                onPress={() => setMenuVisible(false)}
                            >
                                <View style={styles.modalOverlay} />
                            </TouchableWithoutFeedback>

                            <View style={styles.menuContainer}>
                                {/* <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        console.log("Xem hồ sơ");
                                        setMenuVisible(false);
                                    }}
                                >
                                    <Ionicons
                                        name="person-outline"
                                        size={18}
                                        color="#333"
                                        style={{ marginRight: 10 }}
                                    />
                                    <Text style={styles.menuText}>
                                        Xem hồ sơ
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        console.log("Cài đặt");
                                        setMenuVisible(false);
                                    }}
                                >
                                    <Ionicons
                                        name="settings-outline"
                                        size={18}
                                        color="#333"
                                        style={{ marginRight: 10 }}
                                    />
                                    <Text style={styles.menuText}>Cài đặt</Text>
                                </TouchableOpacity> */}

                                <TouchableOpacity
                                    style={[
                                        styles.menuItem,
                                        {
                                            borderTopWidth: 1,
                                            borderTopColor: "#ddd",
                                        },
                                    ]}
                                    onPress={() => {
                                        GoogleSignin.signOut()
                                        AsyncStorage.removeItem("user");
                                        AsyncStorage.removeItem("token");
                                        router.replace("/login");
                                        setMenuVisible(false);
                                    }}
                                >
                                    <Ionicons
                                        name="log-out-outline"
                                        size={18}
                                        color="red"
                                        style={{ marginRight: 10 }}
                                    />
                                    <Text
                                        style={[
                                            styles.menuText,
                                            { color: "red" },
                                        ]}
                                    >
                                        Đăng xuất
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Modal>
                    </View>
                ),
            }}
        >
            <Stack.Screen name="index" options={{ title: "MoneyTalk" }} />
        </Stack>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
    },
    menuContainer: {
        position: "absolute",
        top: 80,
        left: 18,
        backgroundColor: "#fff",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
        paddingVertical: 6,
        width: 150,
    },
    menuItem: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    menuText: {
        fontSize: 16,
        color: "#333",
    },
});
