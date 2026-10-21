# Vixelia Capital

Website mô phỏng công ty quản lý danh mục đầu tư (phục vụ học tập, không phải lời khuyên đầu tư).

- index.html, optimizer.js, vixelia-portfolio.js: giao diện và công cụ tối ưu danh mục
- prices_case.js, prices_case.json, symbols.json: dữ liệu 5 mã của bài nhóm và danh sách mã gợi ý
- netlify/functions/prices.js: API lấy giá lịch sử, gọi qua /api/prices?tickers=FPT,VCB
- netlify.toml: cấu hình Netlify

Triển khai: nối repo này với Netlify (Import an existing project), để trống Build command.
