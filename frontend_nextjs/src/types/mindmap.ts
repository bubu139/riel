
export type MindMapNode = {
    id: string;
    label: string;
    children: MindMapNode[];
};

export type MindMapNodeWithState = MindMapNode & {
    isExpanded: boolean;
    parentId: string | null;
    level: number;
};

export type NodePosition = {
    x: number;
    y: number;
};

export type Edge = {
    id: string;
    from: NodePosition;
    to: NodePosition;
};

    
