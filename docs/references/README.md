# 参考资料目录

存放 IELTS-mate 项目开发所依赖的官方参考文档。

## 文件清单

| 文件名 | 说明 | 来源 |
|--------|------|------|
| `ielts-writing-band-descriptors.pdf` | IELTS Writing Task 1 & Task 2 官方 Band Descriptors（Band 0-9 全维度） | British Council / IDP / Cambridge |
| `ielts-writing-key-assessment-criteria.pdf` | IELTS Writing 四项评分维度的官方定义和评估标准说明 | British Council / IDP / Cambridge |

## 来源网址

- **IELTS 官方（研究者页面）**: https://www.ielts.org/for-researchers/band-descriptors
- **British Council**: https://takeielts.britishcouncil.org

## 与代码的关系

- `backend/app/services/band_descriptors.py` — 评分标准文本直接从上述 PDF 逐字录入
- 代码中的 Band Descriptors 文本应与这些官方 PDF **完全一致**

## 注意事项

- 这些 PDF 为官方公开发布的评分标准，仅用于开发参考
- Band Descriptors PDF 版本为 Updated May 2023
- 如有更新版本，请及时替换并同步更新 `band_descriptors.py`

最后更新：2026-03-10
