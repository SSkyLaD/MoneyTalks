import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    SafeAreaView,
    StyleSheet,
    Text,
} from "react-native";

type ToastProps = {
    isVisible: boolean;
    message: string;
    type: "success" | "error" | "info";
    onHide: () => void;
};


const toastConfig = {
    success: {
        icon: "checkmark-circle-outline",
        backgroundColor: "#28a745", 
    },
    error: {
        icon: "close-circle-outline",
        backgroundColor: "#dc3545",
    },
    info: {
        icon: "information-circle-outline",
        backgroundColor: "#007bff", 
    },
};

const CustomToast: React.FC<ToastProps> = ({
    isVisible,
    message,
    type,
    onHide,
}) => {

    const slideAnim = useRef(new Animated.Value(-150)).current; 
    const config = toastConfig[type] || toastConfig.info;

    useEffect(() => {
        if (isVisible) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start();
            const timer = setTimeout(() => {
                onHide();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            Animated.timing(slideAnim, {
                toValue: -150,
                duration: 300,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, slideAnim, onHide]);

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <SafeAreaView
                style={[
                    styles.toastBody,
                    { backgroundColor: config.backgroundColor },
                ]}
            >
                <Ionicons
                    name={config.icon as any}
                    size={24}
                    color="#fff"
                />
                <Text style={styles.messageText}>{message}</Text>
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
    },
    toastBody: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    messageText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "bold",
        marginLeft: 10,
        flexShrink: 1, 
    },
});

export default CustomToast;