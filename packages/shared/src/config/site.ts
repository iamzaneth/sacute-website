export const organization = {
  shortName: 'SACUTE',
  name: 'Trung tâm Tư vấn và Hỗ trợ Sinh viên',
  institution: 'Trường Đại học Công nghệ Kỹ thuật TP.HCM',
  englishName: 'Student Assistance Center',
  email: 'sacute@hcmute.edu.vn',
  phone: null,
  address: 'Số 01, Võ Văn Ngân, P. Thủ Đức, TP. HCM',
  socialLinks: [
    { name: 'Facebook', url: 'https://www.facebook.com/hotrosinhvienspkt' },
    { name: 'TikTok', url: 'https://www.tiktok.com/@sacute.2015' },
  ],
  mapUrl: null,
} as const;

export const publicRoutes = [
  '/',
  '/information',
  '/scholarships',
  '/events',
  '/contact',
  '/recruitment',
] as const;
export type PublicPath = (typeof publicRoutes)[number];
export const navigation: readonly { path: PublicPath; label: string }[] = [
  { path: '/', label: 'Trang chủ' },
  { path: '/information', label: 'Thông tin' },
  { path: '/scholarships', label: 'Học bổng' },
  { path: '/events', label: 'Sự kiện nổi bật' },
  { path: '/contact', label: 'Liên hệ' },
  { path: '/recruitment', label: 'Tuyển thành viên' },
];
