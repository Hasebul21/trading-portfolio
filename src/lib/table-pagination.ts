import type { TablePaginationConfig } from "antd/es/table";

const DEFAULT_PAGE_SIZES = [10, 20, 50] as const;

export type TablePaginationOptions = {
  /** When false, pager stays visible even for one page (default true). */
  hideOnSinglePage?: boolean;
  /** Initial rows per page (default 10). */
  pageSize?: number;
  /** Size-changer options (default 10, 20, 50). */
  pageSizeOptions?: readonly number[];
};

/** Shared client-side pagination for Ant Design `Table` across the app. */
export function tablePagination(
  showTotalLabel: string,
  options?: TablePaginationOptions,
): TablePaginationConfig {
  const pageSize = options?.pageSize ?? 10;
  const pageSizeOptions = options?.pageSizeOptions ?? [...DEFAULT_PAGE_SIZES];
  return {
    pageSize,
    showSizeChanger: true,
    pageSizeOptions: pageSizeOptions.map(String),
    showTotal: (total) => `${total} ${showTotalLabel}`,
    hideOnSinglePage: options?.hideOnSinglePage ?? true,
  };
}
