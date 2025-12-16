import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    GoogleSignin,
    GoogleSigninButton,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from "@react-native-google-signin/google-signin";
import axios, { isAxiosError } from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    View,
    Dimensions,
    ActivityIndicator,
} from "react-native";
import { Config } from "../config";

const { width } = Dimensions.get("window");

GoogleSignin.configure({
    webClientId:
        "1049657371611-qvcdk05bq36h0p1u3cuat0uo8qicg16b.apps.googleusercontent.com",
});

export default function Login() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                const token = await AsyncStorage.getItem("token");
                if (token) {
                    router.replace("/main-app");
                } else {
                    setIsVerifying(false);
                }
            } catch (error) {
                console.error("Lỗi khi kiểm tra AsyncStorage:", error);
                setIsVerifying(false);
            }
        };

        checkLoginStatus();
    }, [router]);

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            const res = await GoogleSignin.signIn();
            if (isSuccessResponse(res)) {
                const response = await axios.post(
                    `${Config.API_BASE_URL}/api/v1/auth/login`,
                    {
                        sub: res.data.user.id,
                        email: res.data.user.email,
                        name: res.data.user.name,
                        picture: res.data.user.photo,
                    }
                );
                console.log("Backend response:", response.data);
                await AsyncStorage.setItem("token", response.data.token);
                await AsyncStorage.setItem(
                    "user",
                    JSON.stringify(response.data.user)
                );
                router.replace("/main-app");
            } else {
                console.error("Sign-in failed:", res);
            }
            setLoading(false);
        } catch (error) {
            if (isErrorWithCode(error)) {
                switch (error.code) {
                    case statusCodes.IN_PROGRESS:
                        Alert.alert("Sign-in is in progress");
                        break;
                    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                        Alert.alert("Play services not available or outdated");
                        break;
                    default:
                    // some other error happened
                }
            }
            if (isAxiosError(error)) {
                console.error("Axios error message:", error.message);
                console.log("Axios error:", error.response?.data);
                console.log("Status code:", error.response?.status);
            } else {
                console.error("Unexpected error:", error);
            }
            setLoading(false);
            Alert.alert("Login failed", "Check console for details");
        }
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
        header: {
            fontSize: 36,
            color: "#ffffff",
            marginTop: 20,
            fontWeight: "bold",
        },
        text: {
            textAlign: "center",
            fontSize: 16,
            width: 300,
            height: 60,
            textAlignVertical: "center",
            color: "#ffffff",
        },
        image: {
            width: 200,
            height: 200,
            borderRadius: 24,
            shadowColor: "#d77b13ff",
            shadowOffset: {
                width: 0,
                height: 14,
            },
            shadowOpacity: 0.24,
            shadowRadius: 15.38,
            elevation: 19,
        },
        lineContainer: {
            width: width * 0.8,
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 20,
        },
        line: {
            flex: 1,
            height: 1,
            backgroundColor: "#ccc",
        },
        lineText: {
            marginHorizontal: 10,
            fontSize: 16,
            color: "#ffffffff",
        },
    });
    if (isVerifying) {
        return (
            <LinearGradient
                colors={["#b9a221ff", "#575345ff"]}
                style={styles.container}
            >
                <ActivityIndicator size="large" color="#ffffff" />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={["#b9a221ff", "#575345ff"]} style={{ flex: 1 }}>
            <View style={styles.container}>
                <Image
                    source={require("../assets/images/splash-icon.png")}
                    style={styles.image}
                />
                <Text style={styles.header}>MoneyTalk</Text>
                <Text numberOfLines={2} style={styles.text}>
                    Đăng nhập để bắt đầu hành trình quản lý tài chính của bạn
                </Text>
                <View style={styles.lineContainer}>
                    <View style={styles.line} />
                    <Text style={styles.lineText}>Đăng nhập</Text>
                    <View style={styles.line} />
                </View>
                {loading ? (
                    <View
                        style={{
                            height: 48,
                            marginBottom: 20,
                            justifyContent: "center",
                        }}
                    >
                        <ActivityIndicator size="large" color="#ffffff" />
                    </View>
                ) : (
                    <GoogleSigninButton
                        onPress={handleGoogleSignIn}
                        size={GoogleSigninButton.Size.Wide}
                        color={GoogleSigninButton.Color.Light}
                        style={{ borderRadius: 24, marginBottom: 20 }}
                    />
                )}
            </View>
        </LinearGradient>
    );
}
