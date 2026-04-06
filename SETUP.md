# Cấu hình và Chạy Backend API

Backend chạy trên **Node.js**, dùng **Express** và **MongoDB**, mặc định lắng nghe cổng **3005**.

---

## 1. Yêu cầu

| Thành phần   | Yêu cầu |
|-------------|---------|
| Node.js     | v18 trở lên (khuyến nghị LTS) |
| MongoDB     | Đã cài và đang chạy (local hoặc remote) |
| npm         | Đi kèm Node.js |

---

## 2. Cấu hình

### 2.1. Biến môi trường (tùy chọn)

Tạo file `.env` trong thư mục `quality-project-main` (copy từ `.env.example`):

```bash
cp .env.example .env
```

Chỉnh sửa `.env` nếu cần:

| Biến | Mô tả | Mặc định |
|------|--------|----------|
| `PORT` | Cổng chạy server | `3005` |
| `MONGODB_URI` | Chuỗi kết nối MongoDB | `mongodb://localhost:27017/my_user_management_db` |

**Ví dụ `.env`:**

```env
PORT=3005
MONGODB_URI=mongodb://localhost:27017/my_user_management_db
```

Nếu không dùng `.env`, backend vẫn chạy với giá trị mặc định (port 3005, MongoDB local).

### 2.2. MongoDB

- **Local:** MongoDB phải đang chạy trên máy.
- **macOS (Homebrew):**
  ```bash
  brew tap mongodb/brew
  brew install mongodb-community
  brew services start mongodb-community
  ```
- **Windows:** Cài [MongoDB Community](https://www.mongodb.com/try/download/community) và chạy service.
- **Dùng MongoDB Atlas:** Đặt `MONGODB_URI` trong `.env` thành chuỗi kết nối Atlas (có username/password và cluster URL).

---

## 3. Cài đặt và Chạy

### Bước 1: Vào thư mục backend

```bash
cd quality-project-main
```

(Trong project của bạn có thể là:  
`cd /Users/xuankien/Desktop/project-hospital/quality-project-main`)

### Bước 2: Cài dependency

```bash
npm install
```

### Bước 3: Chạy server

```bash
npm start
```

Hoặc:

```bash
node app.js
```

### Kết quả khi chạy thành công

Terminal sẽ in tương tự:

```
MongoDB connected
Server running on port 3005
```

API base URL: **http://localhost:3005**

---

## 4. Các endpoint chính

| Method | URL | Mô tả |
|--------|-----|--------|
| POST | `/api/auth/login` | Đăng nhập |
| GET  | `/api/users/profile` | Lấy thông tin user (cần token) |
| ...  | `/api/criteria`, `/api/report` | Tiêu chí, báo cáo |

Frontend (Ant Design Pro) đang cấu hình proxy: request từ `http://localhost:8000/api/*` sẽ được chuyển tiếp tới `http://localhost:3005/api/*`.

---

## 5. Thứ tự chạy khi phát triển

1. **Bật MongoDB** (nếu dùng local).
2. **Chạy Backend** (trong `quality-project-main`):  
   `npm start` → server tại **http://localhost:3005**
3. **Chạy Frontend** (trong `ant-design-pro`):  
   `npm start` → app tại **http://localhost:8000**

---

## 6. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `MongoDB connection error` | MongoDB chưa chạy hoặc sai URI | Bật MongoDB, kiểm tra `MONGODB_URI` trong `.env` |
| `Port 3005 already in use` | Cổng bị chiếm | Đổi `PORT` trong `.env` hoặc tắt process đang dùng cổng 3005 |
| `Cannot find module 'xxx'` | Thiếu dependency | Chạy lại `npm install` |
