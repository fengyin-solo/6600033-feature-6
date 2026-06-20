import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { MCResult, HypTestResult, MCScenario } from '../store/mc'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportChartAsImage(chart: any, filename: string) {
  if (!chart) return
  const dataUrl = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0f172a' })
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

export function exportCSV(result: MCResult, scenario: MCScenario) {
  const samples = result.samples
  const convergence = result.convergence

  let csv = '\uFEFF'
  csv += `蒙特卡洛模拟结果 - ${scenario.name}\n`
  csv += `场景ID,${result.scenario}\n`
  csv += `迭代次数,${result.iterations}\n`
  csv += `估算值,${result.estimate}\n`
  if (result.trueValue !== undefined) csv += `真实值,${result.trueValue}\n`
  if (result.error !== undefined) csv += `误差,${result.error}\n`
  csv += '\n'

  csv += '样本数据\n'
  csv += '序号,样本值\n'
  samples.slice(0, 1000).forEach((v, i) => {
    csv += `${i + 1},${v}\n`
  })
  csv += '\n'

  csv += '收敛过程\n'
  csv += '步数,估算值\n'
  convergence.forEach((v, i) => {
    csv += `${i + 1},${v}\n`
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${scenario.name}_模拟结果.csv`)
}

interface ExportPDFOptions {
  result: MCResult
  scenario: MCScenario
  testResult: HypTestResult | null
  convergenceDataUrl: string
  histogramDataUrl: string
}

export async function exportPDFReport(options: ExportPDFOptions) {
  const { result, scenario, testResult, convergenceDataUrl, histogramDataUrl } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('蒙特卡洛模拟报告', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, y, { align: 'center' })
  y += 10

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(6, 182, 212)
  doc.text('一、模拟场景', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(50)

  const infoItems = [
    ['场景名称', scenario.name],
    ['场景描述', scenario.description],
    ['迭代次数', result.iterations.toString()],
    ['估算值', result.estimate.toFixed(6)],
  ]
  if (result.trueValue !== undefined) infoItems.push(['真实值', result.trueValue.toFixed(6)])
  if (result.error !== undefined) infoItems.push(['误差', result.error.toFixed(6)])

  infoItems.forEach(([label, value]) => {
    doc.setTextColor(120)
    doc.text(label, margin + 5, y)
    doc.setTextColor(30)
    doc.text(value, margin + 50, y)
    y += 6
  })
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(6, 182, 212)
  doc.text('二、收敛过程', margin, y)
  y += 7

  if (convergenceDataUrl) {
    const imgWidth = pageWidth - margin * 2
    const imgHeight = 60
    doc.addImage(convergenceDataUrl, 'PNG', margin, y, imgWidth, imgHeight)
    y += imgHeight + 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(6, 182, 212)
  doc.text('三、样本分布', margin, y)
  y += 7

  if (histogramDataUrl) {
    const imgWidth = pageWidth - margin * 2
    const imgHeight = 60
    doc.addImage(histogramDataUrl, 'PNG', margin, y, imgWidth, imgHeight)
    y += imgHeight + 6
  }

  if (testResult) {
    if (y + 80 > 280) {
      doc.addPage()
      y = margin
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(139, 92, 246)
    doc.text('四、假设检验结果', margin, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(50)

    const testItems = [
      ['检验类型', testResult.testType],
      ['统计量 t', testResult.statistic.toString()],
      ['p 值', testResult.pValue.toString()],
      ['自由度 df', testResult.df?.toString() || '-'],
      ['显著性水平 α', testResult.alpha.toString()],
      ['结论', testResult.significant ? '显著 (p < α)' : '不显著 (p ≥ α)'],
    ]

    testItems.forEach(([label, value]) => {
      doc.setTextColor(120)
      doc.text(label, margin + 5, y)
      doc.setTextColor(testResult.significant ? 239 : 34, testResult.significant ? 68 : 197, testResult.significant ? 68 : 94, 0)
      doc.text(value, margin + 50, y)
      y += 6
    })
    y += 4
  }

  if (y + 50 > 280) {
    doc.addPage()
    y = margin
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(6, 182, 212)
  doc.text('五、结论摘要', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(50)

  const conclusions = generateConclusions(result, scenario, testResult)
  conclusions.forEach(line => {
    if (y + 6 > 280) {
      doc.addPage()
      y = margin
    }
    doc.text(`• ${line}`, margin + 5, y)
    y += 6
  })

  doc.save(`${scenario.name}_模拟报告.pdf`)
}

function generateConclusions(result: MCResult, scenario: MCScenario, testResult: HypTestResult | null): string[] {
  const conclusions: string[] = []

  conclusions.push(`本次${scenario.name}模拟共执行 ${result.iterations} 次迭代。`)
  conclusions.push(`蒙特卡洛估算结果为 ${result.estimate.toFixed(6)}。`)

  if (result.trueValue !== undefined && result.error !== undefined) {
    const relError = (result.error / result.trueValue * 100).toFixed(4)
    conclusions.push(`与真实值 ${result.trueValue.toFixed(6)} 相比，绝对误差为 ${result.error.toFixed(6)}，相对误差为 ${relError}%。`)
  }

  if (result.convergence.length > 10) {
    const lastTen = result.convergence.slice(-10)
    const avg = lastTen.reduce((a, b) => a + b, 0) / lastTen.length
    const variance = lastTen.reduce((s, v) => s + (v - avg) ** 2, 0) / lastTen.length
    if (variance < 0.01) {
      conclusions.push('收敛过程稳定，结果具有较好的可信度。')
    } else {
      conclusions.push('收敛过程波动较大，建议增加迭代次数以提高精度。')
    }
  }

  if (testResult) {
    if (testResult.significant) {
      conclusions.push(`假设检验结果显示 p = ${testResult.pValue} < α = ${testResult.alpha}，两组样本存在显著差异。`)
    } else {
      conclusions.push(`假设检验结果显示 p = ${testResult.pValue} ≥ α = ${testResult.alpha}，两组样本无显著差异。`)
    }
  }

  conclusions.push('本报告由蒙特卡洛模拟与统计假设检验平台自动生成。')

  return conclusions
}

export function elementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
  })
}
