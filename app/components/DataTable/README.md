# DataTable — selection and column filters

## Row selection

Selection is on when you pass `selectable` or any `bulkActions`. A leading checkbox column is
added automatically. Its header checkbox selects or clears every row on the page, and shows
indeterminate when only some rows are selected.

```tsx
const [ids, setIds] = useState<string[]>([]);

<DataTable
  columns={columns}
  data={rows}
  selectable
  getRowId={(row) => String(row.id)}   // ids reported below are these
  onSelectionChange={setIds}           // selected row ids
  onRowSelectionChange={setRows}       // or: the selected row objects
/>
<Button disabled={ids.length === 0} onClick={() => deleteMany(ids)}>Delete</Button>
```

Always pass `getRowId` when you use `onSelectionChange`. Without it TanStack uses the row index,
and those ids change when the page changes.

`ListViewShell` already disables its Delete Selected button until `selectedCount > 0`.

## Column filters (filter row under the headers)

- A text box sits under each column whose column def allows filtering and has an accessor. Turn
  it off for one column with `enableColumnFilter: false`, or in `columnBuilder` with
  `filterable: false`. Turn off the whole row with `columnFilterRow={false}`.
- The box sends its value 300 ms after the user stops typing. Matching is case-insensitive
  "contains". Faceted filters, whose values are arrays, still match exactly.

### Client-side vs server-side

| Table | Where filtering happens |
|---|---|
| No `serverSide` prop (all rows loaded) | In the browser, via `getFilteredRowModel()` over every row. |
| `serverSide` **with** `onColumnFiltersChange` | On the server. The table reports `{ columnId: text }` and jumps back to page 1; the page re-fetches with the filters as query parameters. |
| `serverSide` **without** `onColumnFiltersChange` | No filter boxes are shown. On a server-paged table the browser only holds the current page, so filtering it there would silently hide matches on other pages. |

The server-side lists in this app:

- **`EntityListView`** (`/api/listview/{list}` → `getTableDtl`): sends `filter.COLUMN=text`.
  `getTableDtl` applies `COLUMN::text ILIKE %text%` across all pages. Only columns the list
  actually shows can be filtered.
- **`ResourceListPage`** (`lib/resource`): resources support only the exact-match filters they
  declare in `ResourceDefinition.filters`. A column gets a filter box only if it sets
  `filterParam` to one of those parameter names. The resource API silently ignores unknown
  parameters, so offering boxes for other columns would look like filtering while doing nothing.
  Once a list moves to `EntityListView` (after its `*_vw` view exists in PostgreSQL), every listed
  column is filterable.
