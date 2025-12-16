export type Expense = {
    id: number;
    amount: number;
    description: string;
    expense_date: string;
    created_at: string;
    updated_at: string;
};

export type Message = {
    id: string;
    text?: string;
    image?: string;
    sender: "user" | "bot";
    timestamp: string;
    confirmationData?: {
        request_type:
            | "insert_expenses"
            | "query_expenses"
            | "update_expenses"
            | "delete_expenses";
        data: any;
    };
    queryData?: {
        expenses: Expense[];
        page: number;
        totalPages: number;
        totalRecords: number;
        originalQuery: any;
    };
};

export type ConfirmationContext = {
    id: string
    request_type:
        | "insert_expenses"
        | "query_expenses"
        | "update_expenses"
        | "delete_expenses";
    data: any;
};