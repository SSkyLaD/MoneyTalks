import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Expense, Message } from "./MessageTypes";

const formatAmount = (amount: number) => {
    if (isNaN(amount) || amount === null) return "0 ₫";
    return amount.toLocaleString("vi-VN", {
        style: "currency",
        currency: "VND",
    });
};

const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "Ngày không hợp lệ";
        return date.toLocaleDateString("vi-VN");
    } catch (e) {
        return "Ngày lỗi";
    }
};

type Props = {
    item: Message;
    formatTimestamp: (timestamp: string) => string;
    onFetchPage: (message: Message, page: number) => void;
};

export default function QueryResultBubble({
    item,
    formatTimestamp,
    onFetchPage,
}: Props) {
    if (!item.queryData) {
        return null;
    }

    const { expenses, page, totalPages } = item.queryData;

    const renderExpenseItem = (expense: Expense, index: number) => {
        return (
            <View key={index} style={styles.accordionItemContainer}>
                <View style={styles.collapsedCard}>
                    <Text style={styles.idText}>{expense.id}</Text>
                    <View style={styles.collapsedCardContent}>
                        <Text
                            style={styles.collapsedDescription}
                            numberOfLines={1}
                        >
                            {expense.description || "Chưa có mô tả"}
                        </Text>
                        <Text style={styles.collapsedDate}>
                            {formatDate(expense.expense_date)}
                        </Text>
                    </View>

                    <Text
                        style={[
                            styles.collapsedAmount,
                            expense.amount < 0
                                ? styles.amountRed
                                : styles.amountGreen,
                        ]}
                    >
                        {formatAmount(parseFloat(String(expense.amount)) || 0)}
                    </Text>

                    <Ionicons
                        name="receipt-outline"
                        size={22}
                        color="#555"
                        style={styles.expenseIcon}
                    />
                </View>
            </View>
        );
    };

    const renderPaging = () => {
        return (
            <View style={styles.pagingContainer}>
                <TouchableOpacity
                    style={[
                        styles.pageButton,
                        page <= 1 && styles.disabledButton,
                    ]}
                    disabled={page <= 1}
                    onPress={() => onFetchPage(item, page - 1)}
                >
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.pageText}>
                    Trang {page} / {totalPages}
                </Text>

                <TouchableOpacity
                    style={[
                        styles.pageButton,
                        page >= totalPages && styles.disabledButton,
                    ]}
                    disabled={page >= totalPages}
                    onPress={() => onFetchPage(item, page + 1)}
                >
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.botMessageWrapper}>
            {item.text && (
                <View style={[styles.messageContainer, styles.botMessage]}>
                    <Text style={styles.botText}>{item.text}</Text>
                </View>
            )}

            {expenses.map(renderExpenseItem)}

            {totalPages > 1 && renderPaging()}

            <Text style={styles.timestampText}>
                {formatTimestamp(item.timestamp)}
            </Text>
        </View>
    );
}

const { width } = Dimensions.get("window");

const isSmallScreen = width < 400;
const fontAdjustment = isSmallScreen ? -2 : 0;
const spacingAdjustment = isSmallScreen ? -2 : 0;
const dynamicWidth = isSmallScreen ? "100%" : width * 0.75;

const styles = StyleSheet.create({
    botMessageWrapper: {
        alignItems: "flex-start",
        marginVertical: 4 + spacingAdjustment, 
    },
    messageContainer: {
        width: dynamicWidth, 
        borderRadius: 16 + spacingAdjustment, 
        paddingVertical: 10 + spacingAdjustment, 
        paddingHorizontal: 14 + spacingAdjustment, 
        marginBottom: 4 + spacingAdjustment, 
    },
    botMessage: {
        backgroundColor: "#e5e5ea",
        borderBottomLeftRadius: 4,
    },
    botText: {
        color: "#000",
        fontSize: 16 + fontAdjustment,
        lineHeight: 22 + fontAdjustment, 
    },
    timestampText: {
        fontSize: Math.max(10, 11 + fontAdjustment),
        color: "#888",
        marginTop: 4 + spacingAdjustment,
        marginHorizontal: 8 + spacingAdjustment, 
    },
    accordionItemContainer: {
        marginTop: 8 + spacingAdjustment,
        width: dynamicWidth, 
    },
    collapsedCard: {
        width: "100%",
        backgroundColor: "#f8f9fa",
        borderRadius: 12 + spacingAdjustment, 
        paddingHorizontal: 15 + spacingAdjustment,
        paddingVertical: 12 + spacingAdjustment, 
        borderWidth: 1,
        borderColor: "#e0e0e0ff",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    collapsedCardContent: {
        flex: 1,
        marginRight: 10 + spacingAdjustment,
    },
    collapsedDescription: {
        fontSize: 15 + fontAdjustment, 
        fontWeight: "bold",
        color: "#333",
        flex: 1,
    },
    collapsedAmount: {
        fontSize: 17 + fontAdjustment, 
        fontWeight: "bold",
        marginRight: 10 + spacingAdjustment, 
    },
    amountRed: { color: "#dc3545" },
    amountGreen: { color: "#28a745" },
    collapsedDate: {
        fontSize: 13 + fontAdjustment, 
        color: "#666",
        marginTop: 2,
    },
    pagingContainer: {
        width: dynamicWidth, 
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10 + spacingAdjustment,
    },
    pageButton: {
        backgroundColor: "#0078ff",
        padding: 8 + spacingAdjustment,
        borderRadius: 20,
    },
    disabledButton: {
        backgroundColor: "#aaa",
    },
    pageText: {
        fontSize: 14 + fontAdjustment,
        fontWeight: "bold",
        color: "#333",
    },
    idText: {
        fontSize: 15 + fontAdjustment,
        fontWeight: "500",
        paddingRight: 10 + spacingAdjustment, 
        marginRight: 10 + spacingAdjustment, 
        borderRightWidth: 1,
    },

    expenseIcon: {
        marginLeft: 8 + spacingAdjustment, 
    },
});
