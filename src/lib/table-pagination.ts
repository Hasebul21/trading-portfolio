import type { TablePaginationConfig } from "antd/es/table";

const PAGE_SIZES = [10, 20, 50] as const;

export type TablePaginationOptions = {
  /** When false, pager stays visible even for one page (default true). */
  hideOnSinglePage?: boolean;
};

/** Shared client-side pagination for Ant Design `Table` across the app. */
export function tablePagination(
  showTotalLabel: string,
  options?: TablePaginationOptions,
): TablePaginationConfig {
  return {
    pageSize: 10,
    showSizeChanger: true,
    pageSizeOptions: [...PAGE_SIZES],
    showTotal: (total) => `${total} ${showTotalLabel}`,
    hideOnSinglePage: options?.hideOnSinglePage ?? true,
  };
}
