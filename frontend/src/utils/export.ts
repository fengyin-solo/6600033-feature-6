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
  doc.text('Monte Carlo Simulation Report', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`Generated: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, y, { align: 'center' })
  y += 10

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(6, 182, 212)
  doc.text('1. Simulation Scenario', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(50)

  const infoItems = [
    ['Scenario', scenario.name],
    ['Description', scenario.description],
    ['Iterations', result.iterations.toString()],
    ['Estimate', result.estimate.toFixed(6)],
  ]
  if (result.trueValue !== undefined) infoItems.push(['True Value', result.trueValue.toFixed(6)])
  if (result.error !== undefined) infoItems.push(['Error', result.error.toFixed(6)])

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
  doc.text('2. Convergence Process', margin, y)
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
  doc.text('3. Sample Distribution', margin, y)
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
    doc.text('4. Hypothesis Test Result', margin, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(50)

    const testItems = [
      ['Test Type', testResult.testType],
      ['Statistic t', testResult.statistic.toString()],
      ['p-value', testResult.pValue.toString()],
      ['Degrees of Freedom', testResult.df?.toString() || '-'],
      ['Significance Level alpha', testResult.alpha.toString()],
      ['Conclusion', testResult.significant ? 'Significant (p < alpha)' : 'Not Significant (p >= alpha)'],
    ]

    testItems.forEach(([label, value]) => {
      doc.setTextColor(120)
      doc.text(label, margin + 5, y)
      if (label === 'Conclusion') {
        doc.setTextColor(testResult.significant ? 220 : 34, testResult.significant ? 38 : 197, testResult.significant ? 38 : 94)
      } else {
        doc.setTextColor(30)
      }
      doc.text(value, margin + 55, y)
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
  doc.text('5. Conclusion Summary', margin, y)
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
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2 - 5)
    wrapped.forEach((wline: string) => {
      if (y + 6 > 280) {
        doc.addPage()
        y = margin
      }
      doc.text(`- ${wline}`, margin + 5, y)
      y += 6
    })
  })

  doc.save(`${scenario.name}_Report.pdf`)
}

function generateConclusions(result: MCResult, scenario: MCScenario, testResult: HypTestResult | null): string[] {
  const conclusions: string[] = []

  conclusions.push(`${scenario.name} simulation completed with ${result.iterations} iterations.`)
  conclusions.push(`Monte Carlo estimate: ${result.estimate.toFixed(6)}.`)

  if (result.trueValue !== undefined && result.error !== undefined) {
    const relError = (result.error / result.trueValue * 100).toFixed(4)
    conclusions.push(`Compared to true value ${result.trueValue.toFixed(6)}, absolute error is ${result.error.toFixed(6)}, relative error is ${relError}%.`)
  }

  if (result.convergence.length > 10) {
    const lastTen = result.convergence.slice(-10)
    const avg = lastTen.reduce((a, b) => a + b, 0) / lastTen.length
    const variance = lastTen.reduce((s, v) => s + (v - avg) ** 2, 0) / lastTen.length
    if (variance < 0.01) {
      conclusions.push('Convergence is stable, results are reliable.')
    } else {
      conclusions.push('Convergence shows high variance, consider increasing iterations for better precision.')
    }
  }

  if (testResult) {
    if (testResult.significant) {
      conclusions.push(`Hypothesis test: p = ${testResult.pValue} < alpha = ${testResult.alpha}, significant difference between groups.`)
    } else {
      conclusions.push(`Hypothesis test: p = ${testResult.pValue} >= alpha = ${testResult.alpha}, no significant difference between groups.`)
    }
  }

  conclusions.push('Report generated by Monte Carlo Simulation and Statistical Hypothesis Testing Platform.')

  return conclusions
}
