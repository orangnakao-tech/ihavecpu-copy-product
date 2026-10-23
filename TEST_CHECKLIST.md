# รายการตรวจสอบการทดสอบ

## รายการตรวจสอบฟีเจอร์ Auto-reload หลัง 3 ชั่วโมง (Auto-reload related pages after 3 hours)
- [ ] First use with no lastAutoReloadAt: all matching tabs reload before the action runs
- [ ] Use again within 3 hours: no reload occurs
- [ ] Use after more than 3 hours: reload occurs again
- [ ] A Zaapi tab with unsent text is skipped and the user is warned
- [ ] A DIY page with changed form values is skipped and the user is warned
- [ ] No matching tabs open: the action still runs and no error appears
- [ ] A tab that never reaches "complete" does not block the action
- [ ] Two actions triggered at once run only one reload cycle
- [ ] Nothing is sent in Zaapi automatically
- [ ] Existing features still work

## รายการที่ต้องทดสอบด้วย Chrome จริงและบัญชีที่เข้าสู่ระบบแล้ว
- [ ] เมื่อเปิดใช้งาน/รีโหลดส่วนขยาย หรือเกิดข้อผิดพลาดระหว่างทำงาน: หน้าเว็บทั้ง 3 รีเซ็ตอัตโนมัติและทำคำสั่งต่อจนได้ผลลัพธ์โดยไม่ต้องกดซ้ำ
- [ ] หน้า DIY โดยไม่ได้เปิด AdMeta ไว้ก่อน: กด "คำนวณใน AdMeta แล้วใส่ข้อความใน Zaapi" ครั้งเดียว ระบบเปิด AdMeta ค้นหาและคำนวณสเป็ค แล้วสลับไปวางข้อความที่ช่องแชตในหน้า Zaapi ล่าสุดที่คลิกทันที
- [ ] ไม่มีแท็บ AdMeta: กดครั้งเดียว เปิดหน้า ค้นหา และเลือกเซ็ตโปรได้
- [ ] มีแท็บ AdMeta อยู่แล้ว: กดครั้งเดียวค้นหาและเลือกเซ็ตได้
- [ ] เปิด AdMeta ที่ยังไม่เข้าสู่ระบบ: มีข้อความภาษาไทยให้เข้าสู่ระบบและไม่ค้าง
- [ ] เปิด Zaapi สองหน้าต่าง: ใช้แท็บ Zaapi ที่ผู้ใช้เลือก/ใช้งานล่าสุด
- [ ] เปิด Zaapi สองแท็บในหน้าต่างเดียว: ใช้แท็บ Zaapi ที่เลือกครั้งล่าสุด
- [ ] เปลี่ยน URL DIY ใน SPA หลังสร้างสเป็ค: ปุ่มอัปเดตและคำนวณได้ทันทีโดยไม่รีโหลด
- [ ] คำนวณสเป็ค DIY เดิมได้ตามปกติ
- [ ] Zaapi หน้า login หรือจำกัดจำนวนอุปกรณ์: แจ้งสาเหตุภาษาไทย
- [ ] แผงลอยลาก ย่อ ซ่อน เปิดกลับ และจำตำแหน่งหลังรีโหลดหน้าได้
- [ ] โหมดปุ่ม คีย์ลัด และใช้ทั้งสองแบบ ทำงานตรงตามการตั้งค่า
- [ ] Ctrl+Shift+Y และ Ctrl+Shift+U ทำงานตามที่ระบุในคู่มือ
- [ ] ข้อความและรูปถูกเตรียมในช่องแชต แต่ไม่มีการกดส่งอัตโนมัติ
- [ ] คัดลอกข้อความ ดาวน์โหลดรูป และแนบรูปใน Zaapi ได้
- [ ] ตรวจการดึงราคาเมื่อมีราคา metadata, ราคาเดิม, ราคาผ่อน และราคาขีดฆ่า

## ผลตรวจเชิงสถิติก่อนส่งมอบ
- [x] JavaScript ทุกไฟล์ผ่าน `node --check`
- [x] `manifest.json` เป็น Manifest V3 และไม่มี permission `scripting`
- [x] ไม่มีการใช้ background timer หรือ `chrome.alarms` ในการตรวจสอบเวลา
- [x] จัดการ concurrency ด้วย in-memory promise
- [x] ทุกไฟล์ในโฟลเดอร์แพ็กเกจมีเนื้อหาจริง

การทำงานบนเว็บไซต์จริงและการเข้าสู่ระบบ AdMeta/Zaapi ยังต้องยืนยันตามรายการด้านบนใน Chrome ของผู้ใช้
