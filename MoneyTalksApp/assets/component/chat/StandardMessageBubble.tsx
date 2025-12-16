import React from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import { Message } from "./MessageTypes";
import { Config } from "../../../config";

type Props = {
    item: Message;
    isUser: boolean;
    formatTimestamp: (timestamp: string) => string;
};

export default function StandardMessageBubble({
    item,
    isUser,
    formatTimestamp,
}: Props) {
    return (
        <View
            style={
                isUser ? styles.userMessageWrapper : styles.botMessageWrapper
            }
        >
            <View
                style={[
                    styles.messageContainer,
                    isUser ? styles.userMessage : styles.botMessage,
                ]}
            >
                {item.text && (
                    <Text style={isUser ? styles.userText : styles.botText}>
                        {item.text}
                    </Text>
                )}
                {item.image && (
                    <Image
                        source={{
                            uri: item.image.toString().startsWith("file:///")
                                ? item.image
                                : Config.API_BASE_URL + "/" + item.image,
                        }}
                        style={styles.chatImage}
                    />
                )}
            </View>
            <Text style={styles.timestampText}>
                {formatTimestamp(item.timestamp)}
            </Text>
        </View>
    );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
    userMessageWrapper: {
        alignItems: "flex-end",
        marginVertical: 4,
    },
    botMessageWrapper: {
        alignItems: "flex-start",
        marginVertical: 4,
    },
    messageContainer: {
        maxWidth: width * 0.75,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    userMessage: {
        backgroundColor: "#0078ff",
        borderBottomRightRadius: 4,
    },
    botMessage: {
        backgroundColor: "#e5e5ea",
        borderBottomLeftRadius: 4,
    },
    userText: {
        color: "#fff",
        fontSize: 16,
    },
    botText: {
        color: "#000",
        fontSize: 16,
        lineHeight: 22,
    },
    timestampText: {
        fontSize: 11,
        color: "#888",
        marginTop: 4,
        marginHorizontal: 8,
    },
    chatImage: {
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: 12,
        resizeMode: "cover",
    },
});
