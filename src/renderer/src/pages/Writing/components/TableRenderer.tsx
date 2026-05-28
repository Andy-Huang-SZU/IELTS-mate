import type { ChartData } from '../../../services/writing'

export function TableRenderer({ chartData }: { chartData: ChartData }) {
  const columns = chartData.columns
  const rows = chartData.rows
  if (!columns?.length || !rows?.length) return null

  return (
    <div className="mt-4 overflow-x-auto">
      {chartData.title && (
        <p className="text-xs text-[#636E72] mb-2 text-center font-medium">{chartData.title}</p>
      )}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className="border border-[#DFE6E9]/60 bg-[#5EEAD4]/10 px-3 py-2 text-left font-semibold text-[#2D3436]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white/40' : 'bg-[#F7F6F2]/60'}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-[#DFE6E9]/40 px-3 py-2 text-[#2D3436]/80">
                  {typeof cell === 'number' ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {chartData.unit && (
        <p className="text-[11px] text-[#B2BEC3] mt-1.5 text-right">Unit: {chartData.unit}</p>
      )}
    </div>
  )
}
