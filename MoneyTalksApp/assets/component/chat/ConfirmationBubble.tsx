import { Ionicons } from "@expo/vector-icons";
import Checkbox from "expo-checkbox";
import React, { useState } from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TextInput,
    TextStyle,
    TouchableOpacity,
    View,
} from "react-native";
import { ConfirmationContext, Message } from "./MessageTypes";

type Props = {
    item: Message;
    context: ConfirmationContext;
    formatTimestamp: (timestamp: string) => string;
    onConfirm: () => void;
    onCancel: () => void;
    onInsertDataChange: (
        index: number,
        field: "description" | "amount" | "expense_date" | "submit",
        value: string | boolean
    ) => void;
    onUpdateDataChange: (
        field: "updated_amount" | "updated_date" | "updated_description",
        value: string
    ) => void;
    onDeleteDataChange: (
        index: number,
        field: "submit",
        value: boolean
    ) => void;
    onQueryDataChange: (
        field:
            | "start_date"
            | "end_date"
            | "min_amount"
            | "max_amount"
            | "key_words",
        value: string
    ) => void;
    onDateOpen: (index: number | string, date: string) => void;
};

const formatAmount = (amount: number) => {
    if (isNaN(amount) || amount === null) return "0 ₫";
    return amount.toLocaleString("vi-VN", {
        style: "currency",
        currency: "VND",
    });
};
const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
    });
};

export default function ConfirmationBubble({
    item,
    context,
    formatTimestamp,
    onConfirm,
    onCancel,
    onInsertDataChange,
    onUpdateDataChange,
    onDeleteDataChange,
    onQueryDataChange,
    onDateOpen,
}: Props) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [isQueryExpanded, setIsQueryExpanded] = useState(false);

    if (item.confirmationData?.request_type === "insert_expenses") {
        return (
            <View style={styles.botMessageWrapper}>
                <View style={[styles.messageContainer, styles.botMessage]}>
                    <Text style={styles.botText}>{item.text}</Text>
                </View>
                {context.data.expenses?.map((expense: any, index: number) => {
                    const isExpanded = expandedIndex === index;

                    return (
                        <View key={index} style={styles.accordionItemContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.collapsedCard,
                                    isExpanded && styles.collapsedCardExpanded,
                                ]}
                                onPress={() =>
                                    setExpandedIndex(isExpanded ? null : index)
                                }
                            >
                                <Checkbox
                                    style={styles.checkbox}
                                    value={expense.submit}
                                    onValueChange={(newValue) =>
                                        onInsertDataChange(
                                            index,
                                            "submit",
                                            newValue
                                        )
                                    }
                                    color={
                                        expense.submit ? "#28a745" : undefined
                                    }
                                />
                                <View style={styles.collapsedCardContent}>
                                    <View style={styles.collapsedRow}>
                                        <Text
                                            style={styles.collapsedDescription}
                                            numberOfLines={1}
                                        >
                                            {expense.description ||
                                                "Chưa có mô tả"}
                                        </Text>
                                    </View>
                                    <Text style={styles.collapsedDate}>
                                        {expense.expense_date}
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.collapsedAmount,
                                        parseFloat(expense.amount) < 0 && {
                                            color: "#dc3545",
                                        },
                                    ]}
                                >
                                    {formatAmount(
                                        parseFloat(expense.amount) || 0
                                    )}
                                </Text>
                                <Ionicons
                                    name={
                                        isExpanded
                                            ? "chevron-up-outline"
                                            : "chevron-down-outline"
                                    }
                                    size={22}
                                    color="#555"
                                />
                            </TouchableOpacity>
                            {isExpanded && (
                                <View style={styles.editCard}>
                                    <Text style={styles.confirmationTitle}>
                                        Mô tả
                                    </Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={expense.description}
                                        placeholder="Nội dung"
                                        onChangeText={(text) =>
                                            onInsertDataChange(
                                                index,
                                                "description",
                                                text
                                            )
                                        }
                                    />
                                    <Text style={styles.confirmationTitle}>
                                        Số tiền
                                    </Text>
                                    <TextInput
                                        style={[styles.editInput]}
                                        value={String(expense.amount)}
                                        placeholder="Số tiền"
                                        keyboardType="numeric"
                                        onChangeText={(text) =>
                                            onInsertDataChange(
                                                index,
                                                "amount",
                                                text
                                            )
                                        }
                                    />
                                    <Text style={styles.confirmationTitle}>
                                        Ngày thu chi
                                    </Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.editInput,
                                            styles.datePickerButton,
                                        ]}
                                        onPress={() =>
                                            onDateOpen(
                                                index,
                                                expense.expense_date
                                            )
                                        }
                                    >
                                        <Text style={styles.datePickerText}>
                                            {formatDate(expense.expense_date)}
                                        </Text>
                                        <Ionicons
                                            name="calendar-outline"
                                            size={20}
                                            color="#555"
                                        />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}

                <View style={styles.confirmationBubbleContainer}>
                    <TouchableOpacity
                        style={[
                            styles.confirmationButton,
                            styles.confirmButton,
                        ]}
                        onPress={onConfirm}
                    >
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Đồng ý
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.confirmationButton, styles.cancelButton]}
                        onPress={onCancel}
                    >
                        <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Hủy bỏ
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.timestampText}>
                    {formatTimestamp(item.timestamp)}
                </Text>
            </View>
        );
    }

    if (item.confirmationData?.request_type === "update_expenses") {
        const currentData = context.data;
        const originalData = context.data.originalExpense;

        if (!originalData) {
            return (
                <View style={styles.botMessageWrapper}>
                    <View style={[styles.messageContainer, styles.botMessage]}>
                        <Text style={styles.botText}>{item.text}</Text>
                    </View>
                    <View style={styles.editCard}>
                        <Text style={[styles.botText, { color: "red" }]}>
                            Lỗi: Không thể tải dữ liệu gốc để so sánh.
                        </Text>
                    </View>
                </View>
            );
        }

        const displayDescription =
            currentData.updated_description === null
                ? originalData.description
                : currentData.updated_description;

        const displayAmount =
            currentData.updated_amount === null
                ? String(originalData.amount)
                : String(currentData.updated_amount);

        const displayDate =
            currentData.updated_date === null
                ? formatDate(originalData.expense_date)
                : formatDate(currentData.updated_date);

        const isDescChanged = displayDescription !== originalData.description;
        const isAmountChanged = displayAmount !== String(originalData.amount);
        const isDateChanged =
            displayDate !== formatDate(originalData.expense_date);

        const changedTextStyle: TextStyle = {
            fontWeight: "bold",
            color: "#0056b3",
        };

        return (
            <View style={styles.botMessageWrapper}>
                <View style={[styles.messageContainer, styles.botMessage]}>
                    <Text style={styles.botText}>{item.text}</Text>
                </View>
                <View style={styles.editCard}>
                    <Text style={styles.confirmationTitle}>
                        ID {currentData?.id}
                    </Text>

                    <Text style={styles.confirmationTitle}>Mô tả</Text>
                    <TextInput
                        style={[
                            styles.editInput,
                            isDescChanged && changedTextStyle,
                        ]}
                        value={displayDescription}
                        placeholder={originalData.description}
                        placeholderTextColor="#aaa"
                        onChangeText={(text) =>
                            onUpdateDataChange("updated_description", text)
                        }
                    />

                    <Text style={styles.confirmationTitle}>Số tiền</Text>
                    <TextInput
                        style={[
                            styles.editInput,
                            isAmountChanged && changedTextStyle,
                        ]}
                        value={displayAmount}
                        placeholder={String(originalData.amount)}
                        placeholderTextColor="#aaa"
                        keyboardType="numeric"
                        onChangeText={(text) =>
                            onUpdateDataChange("updated_amount", text)
                        }
                    />

                    <Text style={styles.confirmationTitle}>Ngày thu chi</Text>
                    <TouchableOpacity
                        style={[styles.editInput, styles.datePickerButton]}
                        onPress={() => onDateOpen("", displayDate)}
                    >
                        <Text
                            style={[
                                styles.datePickerText,
                                isDateChanged && changedTextStyle,
                            ]}
                        >
                            {displayDate}
                        </Text>
                        <Ionicons
                            name="calendar-outline"
                            size={20}
                            color="#555"
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.confirmationBubbleContainer}>
                    <TouchableOpacity
                        style={[
                            styles.confirmationButton,
                            styles.confirmButton,
                        ]}
                        onPress={onConfirm}
                    >
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Đồng ý
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.confirmationButton, styles.cancelButton]}
                        onPress={onCancel}
                    >
                        <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Hủy bỏ
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.timestampText}>
                    {formatTimestamp(item.timestamp)}
                </Text>
            </View>
        );
    }

    if (item.confirmationData?.request_type === "query_expenses") {
        const queryData = context.data;
        return (
            <View style={styles.botMessageWrapper}>
                <View style={[styles.messageContainer, styles.botMessage]}>
                    <Text style={styles.botText}>{item.text}</Text>
                </View>

                <View style={styles.accordionItemContainer}>
                    <TouchableOpacity
                        style={[
                            styles.collapsedCard,
                            isQueryExpanded && styles.collapsedCardExpanded,
                        ]}
                        onPress={() => setIsQueryExpanded(!isQueryExpanded)}
                    >
                        <View style={styles.collapsedCardContent}>
                            <Text style={styles.queryText} numberOfLines={1}>
                                <Text style={styles.queryLabel}>Từ khóa:</Text>{" "}
                                {queryData.key_words &&
                                queryData.key_words.length > 0
                                    ? queryData.key_words.join(", ")
                                    : "Không có"}
                            </Text>
                            <Text style={styles.queryText} numberOfLines={1}>
                                <Text style={styles.queryLabel}>Ngày:</Text>{" "}
                                {queryData.start_date
                                    ? formatDate(queryData.start_date)
                                    : "..."}{" "}
                                -{" "}
                                {queryData.end_date
                                    ? formatDate(queryData.end_date)
                                    : "..."}
                            </Text>
                        </View>
                        <Ionicons
                            name={
                                isQueryExpanded
                                    ? "chevron-up-outline"
                                    : "chevron-down-outline"
                            }
                            size={22}
                            color="#555"
                        />
                    </TouchableOpacity>

                    {isQueryExpanded && (
                        <View style={styles.editCard}>
                            {/* Từ khóa */}
                            <Text style={styles.confirmationTitle}>
                                Từ khóa (ngăn cách bằng dấu phẩy)
                            </Text>
                            <TextInput
                                style={styles.editInput}
                                placeholder="ăn, uống, đi chơi..."
                                // Hiển thị mảng dưới dạng string
                                value={
                                    queryData.key_words
                                        ? queryData.key_words.join(", ")
                                        : ""
                                }
                                onChangeText={(text) =>
                                    // Gửi string thô lên
                                    onQueryDataChange("key_words", text)
                                }
                            />

                            {/* Ngày bắt đầu */}
                            <Text style={styles.confirmationTitle}>
                                Từ ngày
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.editInput,
                                    styles.datePickerButton,
                                ]}
                                onPress={() =>
                                    onDateOpen(
                                        "query_start",
                                        queryData.start_date || ""
                                    )
                                }
                            >
                                <Text style={styles.datePickerText}>
                                    {queryData.start_date
                                        ? formatDate(queryData.start_date)
                                        : "Chọn ngày"}
                                </Text>
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color="#555"
                                />
                            </TouchableOpacity>

                            {/* Ngày kết thúc */}
                            <Text style={styles.confirmationTitle}>
                                Đến ngày
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.editInput,
                                    styles.datePickerButton,
                                ]}
                                onPress={() =>
                                    onDateOpen(
                                        "query_end", // Định danh duy nhất
                                        queryData.end_date || ""
                                    )
                                }
                            >
                                <Text style={styles.datePickerText}>
                                    {queryData.end_date
                                        ? formatDate(queryData.end_date)
                                        : "Chọn ngày"}
                                </Text>
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color="#555"
                                />
                            </TouchableOpacity>

                            {/* Số tiền tối thiểu */}
                            <Text style={styles.confirmationTitle}>
                                Số tiền tối thiểu
                            </Text>
                            <TextInput
                                style={styles.editInput}
                                placeholder="0"
                                keyboardType="numeric"
                                value={String(queryData.min_amount || "")}
                                onChangeText={(text) =>
                                    onQueryDataChange("min_amount", text)
                                }
                            />

                            {/* Số tiền tối đa */}
                            <Text style={styles.confirmationTitle}>
                                Số tiền tối đa
                            </Text>
                            <TextInput
                                style={styles.editInput}
                                placeholder="Không giới hạn"
                                keyboardType="numeric"
                                value={String(queryData.max_amount || "")}
                                onChangeText={(text) =>
                                    onQueryDataChange("max_amount", text)
                                }
                            />
                        </View>
                    )}
                </View>

                {/* 5. Nút Bấm Xác nhận (Không đổi) */}
                <View style={styles.confirmationBubbleContainer}>
                    <TouchableOpacity
                        style={[
                            styles.confirmationButton,
                            styles.confirmButton,
                        ]}
                        onPress={onConfirm}
                    >
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Tìm kiếm
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.confirmationButton, styles.cancelButton]}
                        onPress={onCancel}
                    >
                        <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Hủy bỏ
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* 6. Dấu thời gian (Không đổi) */}
                <Text style={styles.timestampText}>
                    {formatTimestamp(item.timestamp)}
                </Text>
            </View>
        );
    }

    if (item.confirmationData?.request_type === "delete_expenses") {
        const expensesToDelete = context.data;
        return (
            <View style={styles.botMessageWrapper}>
                <View style={[styles.messageContainer, styles.botMessage]}>
                    <Text style={styles.botText}>{item.text}</Text>
                </View>

                {expensesToDelete?.map((expense: any, index: number) => {
                    return (
                        <View key={index} style={styles.accordionItemContainer}>
                            <View style={styles.collapsedCard}>
                                <Text style={styles.idText}>{expense.id}</Text>
                                <Checkbox
                                    style={styles.checkbox}
                                    value={expense.submit}
                                    onValueChange={(newValue) =>
                                        onDeleteDataChange(
                                            index,
                                            "submit",
                                            newValue
                                        )
                                    }
                                    color={
                                        expense.submit ? "#dc3545" : undefined
                                    }
                                />
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
                                        { color: "#dc3545" },
                                    ]}
                                >
                                    {formatAmount(
                                        parseFloat(expense.amount) || 0
                                    )}
                                </Text>
                            </View>
                        </View>
                    );
                })}

                <View style={styles.confirmationBubbleContainer}>
                    <TouchableOpacity
                        style={[styles.confirmationButton, styles.cancelButton]}
                        onPress={onConfirm}
                    >
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                        <Text style={styles.confirmationButtonText}>
                            Xác nhận Xóa
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.confirmationButton,
                            { backgroundColor: "#6c757d" },
                        ]}
                        onPress={onCancel}
                    >
                        <Ionicons
                            name="close-circle-outline"
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.confirmationButtonText}>
                            Hủy bỏ
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.timestampText}>
                    {formatTimestamp(item.timestamp)}
                </Text>
            </View>
        );
    }

    return null;
}

const { width } = Dimensions.get("window");

const isSmallScreen = width < 400;
const fontAdjustment = isSmallScreen ? -2 : 0;
const spacingAdjustment = isSmallScreen ? -2 : 0;
const dynamicWidth = isSmallScreen ? "100%" : width * 0.75;
const dynamicMaxWidth = isSmallScreen ? "100%" : width * 0.75;

const styles = StyleSheet.create({
    botMessageWrapper: {
        alignItems: "flex-start",
        marginVertical: 4 + spacingAdjustment,
    },
    messageContainer: {
        maxWidth: dynamicMaxWidth,
        borderRadius: 16 + spacingAdjustment,
        paddingVertical: 10 + spacingAdjustment,
        paddingHorizontal: 14 + spacingAdjustment,
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

    editCard: {
        width: dynamicWidth,
        backgroundColor: "#f0f0f0ff",
        padding: 10 + spacingAdjustment,
        paddingTop: 0,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        marginTop: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 12 + spacingAdjustment,
        borderBottomRightRadius: 12 + spacingAdjustment,
    },
    editInput: {
        backgroundColor: "#fff",
        borderRadius: 8,
        paddingHorizontal: 10 + spacingAdjustment,
        paddingVertical: 12 + spacingAdjustment,
        fontSize: 15 + fontAdjustment,
        borderWidth: 1,
        borderColor: "#ccc",
        marginTop: 4 + spacingAdjustment,
    },
    confirmationTitle: {
        fontSize: 13 + fontAdjustment,
        fontWeight: "bold",
        color: "#666",
        marginTop: 5 + spacingAdjustment,
        marginBottom: 3 + spacingAdjustment,
        marginLeft: 5 + spacingAdjustment,
    },
    datePickerButton: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12 + spacingAdjustment,
    },
    datePickerText: {
        fontSize: 15 + fontAdjustment,
        color: "#333",
    },

    accordionItemContainer: {
        marginTop: 8 + spacingAdjustment,
        width: dynamicWidth,
    },
    checkbox: {
        marginRight: 10 + spacingAdjustment,
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
    collapsedCardExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    collapsedCardContent: {
        flex: 1,
        marginRight: 10 + spacingAdjustment,
    },
    idText: {
        fontSize: 15 + fontAdjustment,
        color: "#666",
        fontWeight: "500",
        paddingRight: 10 + spacingAdjustment,
        marginRight: 10 + spacingAdjustment,
        borderRightWidth: 1,
    },
    collapsedRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 2,
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
        color: "#28a745",
        marginRight: 10 + spacingAdjustment,
    },
    collapsedDate: {
        fontSize: 13 + fontAdjustment,
        color: "#666",
    },
    queryCard: {
        width: dynamicWidth,
        backgroundColor: "#f8f9fa",
        borderRadius: 12 + spacingAdjustment,
        paddingVertical: 10 + spacingAdjustment,
        paddingHorizontal: 15 + spacingAdjustment,
        marginTop: 8 + spacingAdjustment,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    queryText: {
        fontSize: 14 + fontAdjustment,
        color: "#333",
        marginBottom: 5 + spacingAdjustment,
        lineHeight: 20 + fontAdjustment,
    },
    queryLabel: {
        fontWeight: "bold",
        color: "#555",
    },

    confirmationBubbleContainer: {
        flexDirection: "row",
        marginTop: 10 + spacingAdjustment,
        maxWidth: dynamicMaxWidth,
    },
    confirmationButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8 + spacingAdjustment,
        paddingHorizontal: 12 + spacingAdjustment,
        borderRadius: 20,
        marginHorizontal: Math.max(2, 4 + spacingAdjustment),
    },
    confirmButton: {
        backgroundColor: "#28a745",
    },
    cancelButton: {
        backgroundColor: "#dc3545",
    },
    confirmationButtonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14 + fontAdjustment,
        marginLeft: 5 + spacingAdjustment,
    },
});
