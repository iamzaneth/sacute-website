export interface RecruitmentTeam {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  icon: 'megaphone' | 'clipboard' | 'graduation-cap' | 'presentation' | 'house';
  responsibilities: readonly string[];
  requirements: readonly string[];
  benefits: readonly string[];
  editorialNote?: string;
}

// Transcribed content supplied in the recruitment enhancement brief.
// Dates and application status are intentionally managed separately.
export const recruitmentTeams: readonly RecruitmentTeam[] = [
  {
    id: 'communications',
    slug: 'communications',
    name: 'Truyền thông',
    shortDescription:
      'Thiết kế, sáng tạo hình ảnh và truyền tải thông điệp cho các hoạt động của SACUTE.',
    icon: 'megaphone',
    responsibilities: [
      'Thiết kế các poster, ấn phẩm, quay phim - chụp ảnh truyền thông cho các chương trình, hội thảo, các hoạt động thường niên của SACUTE.',
      'Tạo dựng visual đồng bộ, template cho các team của SACUTE.',
      'Thiết kế ấn phẩm cho các ngày lễ, chúc mừng, sự kiện đặc biệt.',
      'Tạo các sản phẩm mang tính viral truyền tải thông điệp của SACUTE.',
    ],
    requirements: [
      'Sử dụng các công cụ thiết kế, chỉnh sửa cơ bản: Illustrator, Photoshop,... hoặc các phần mềm tương đương.',
      'Hiểu về bố cục, màu sắc, font chữ.',
      'Biết sử dụng các phần mềm dựng video: Premiere, CapCut,...',
      'Biết quay chụp ảnh cơ bản bằng máy ảnh.',
      'Vui vẻ, hoạt bát và yêu thích công việc.',
      'Tích cực, hòa đồng, sẵn sàng hỗ trợ đồng đội khi cần.',
    ],
    benefits: [
      'Được làm thật – học thật qua các dự án thiết kế poster, visual, template cho các chương trình lớn nhỏ của SACUTE.',
      'Có cơ hội học hỏi kỹ năng dựng video, chạy truyền thông trên nền tảng số (Facebook, TikTok,...).',
      'Được tham gia các hoạt động, chương trình do SACUTE tổ chức.',
      'Được học hỏi, trau dồi thêm kiến thức về thiết kế.',
      'Được giao lưu gặp gỡ với các thành viên từ nhiều khoa - ngành khác nhau.',
    ],
  },
  {
    id: 'administration',
    slug: 'administration',
    name: 'Hành chính - Văn phòng',
    shortDescription:
      'Tư vấn sinh viên, xử lý hồ sơ và cùng chăm lo hoạt động nội bộ trung tâm.',
    icon: 'clipboard',
    responsibilities: [
      'Tư vấn và hỗ trợ giải đáp các thắc mắc của Sinh viên.',
      'Xử lý và lưu trữ các văn bản giấy tờ.',
      'Quản lý cơ sở vật chất của Trung tâm.',
      'Tiếp nhận, thông báo, lưu trữ và tổng hợp hồ sơ học bổng.',
      'Lên kế hoạch và tổ chức các hoạt động nội bộ Trung tâm.',
    ],
    requirements: [
      'Tính cách vui vẻ, hòa đồng, cởi mở, trung thực.',
      'Nhiệt tình, chủ động và có trách nhiệm với công việc.',
      'Có khả năng xử lý các tình huống phát sinh.',
      'Có khả năng tổ chức và sắp xếp thời gian, công việc.',
      'Yêu thích công việc liên quan đến văn bản giấy tờ.',
      'Có khả năng thiết kế cơ bản.',
    ],
    benefits: [
      'Được làm việc trong môi trường năng động, cởi mở và linh hoạt.',
      'Có thêm kinh nghiệm lên kế hoạch và cách tổ chức các chương trình giao lưu nội bộ.',
      'Được học kỹ năng xử lý văn bản giấy tờ, quản lý tài chính.',
      'Được học kỹ năng về tin học văn phòng (Google Sheets, Docs,...).',
    ],
  },
  {
    id: 'academics',
    slug: 'academics',
    name: 'Học tập',
    shortDescription:
      'Kết nối cộng đồng học tập, tổ chức ôn tập và hỗ trợ giải đáp cho sinh viên.',
    icon: 'graduation-cap',
    responsibilities: [
      'Xây dựng, lên ý tưởng cho các hoạt động, truyền thông cho Fanpage Online Learning Community - SACUTE.',
      'Tổ chức, quản lý các lớp ôn tập cho sinh viên trường như Ôn tập mùa thi,...',
      'Thiết kế, viết nội dung cho bài đăng, ấn phẩm truyền thông cho Fanpage.',
      'Tư vấn, hỗ trợ giải đáp các thắc mắc về học tập cho Sinh viên.',
    ],
    requirements: [
      'Sử dụng các công cụ thiết kế, chỉnh sửa cơ bản: Illustrator, Photoshop,... hoặc các phần mềm tương đương.',
      'Hiểu về bố cục, màu sắc, font chữ.',
      'Biết sử dụng các phần mềm dựng video: Premiere, CapCut,...',
      'Biết quay chụp ảnh cơ bản bằng máy ảnh.',
      'Vui vẻ, hoạt bát và yêu thích công việc.',
      'Tích cực, hòa đồng, sẵn sàng hỗ trợ đồng đội khi cần.',
    ],
    benefits: [
      'Được làm thật – học thật qua các dự án thiết kế poster, visual, template cho các chương trình lớn nhỏ của SACUTE.',
      'Có cơ hội học hỏi kỹ năng dựng video, chạy truyền thông trên nền tảng số (Facebook, TikTok,...).',
      'Được tham gia các hoạt động, chương trình do SACUTE tổ chức.',
      'Được học hỏi, trau dồi thêm kiến thức về thiết kế.',
      'Được giao lưu gặp gỡ với các thành viên từ nhiều khoa - ngành khác nhau.',
    ],
    editorialNote:
      'Yêu cầu và quyền lợi của ban Học tập trong nội dung được cung cấp trùng với ban Truyền thông. Nội dung này đang chờ xác nhận biên tập.',
  },
  {
    id: 'skills-workshops',
    slug: 'skills-workshops',
    name: 'Hội thảo Kỹ năng',
    shortDescription:
      'Lên ý tưởng, tổ chức hội thảo và phối hợp vận hành các chương trình kỹ năng.',
    icon: 'presentation',
    responsibilities: [
      'Tổ chức các chương trình, sự kiện: Hội thảo, Lớp học Kỹ năng, Webinar,...',
      'Lên ý tưởng, kịch bản, nội dung và kế hoạch cho các chương trình sự kiện.',
      'Liên hệ và trao đổi với các khách mời hoặc các diễn giả trong chương trình.',
      'Xây dựng lộ trình và thiết kế ấn phẩm truyền thông (Poster, standee,...).',
      'Điều chỉnh dàn âm thanh, ánh sáng, hỗ trợ trình chiếu slide, điều phối.',
    ],
    requirements: [
      'Có đam mê và quan tâm đến việc tổ chức sự kiện là một lợi thế lớn.',
      'Có tư duy sáng tạo, tích cực học hỏi điều mới, tinh thần trách nhiệm với công việc, trung thực, vui vẻ hòa đồng và giúp đỡ lẫn nhau.',
      'Có khả năng tổ chức và biên tập kế hoạch.',
      'Có năng khiếu như MC, quản trò, ca hát,... là một lợi thế.',
      'Có khả năng dùng được phần mềm thiết kế 2D: Photoshop, Illustrator, Canva,...',
      'Tinh thần làm việc nhóm và chịu áp lực cơ bản.',
    ],
    benefits: [
      'Được có cơ hội làm việc với khách mời, diễn giả nổi tiếng.',
      'Được tiếp xúc với môi trường làm việc thân thiện, năng động và cởi mở.',
      'Được training các kỹ năng thiết kế cần thiết cho công việc (thiết kế, viết content, cách thức tổ chức sự kiện,...).',
      'Được phát huy tối đa các năng khiếu của bản thân, được giao lưu, học hỏi kinh nghiệm.',
      'Được tham gia tổ chức các sự kiện tại các chương trình tình nguyện.',
    ],
  },
  {
    id: 'housing-employment',
    slug: 'housing-employment',
    name: 'Nhà trọ - Việc làm',
    shortDescription:
      'Tư vấn nhà trọ, việc làm và xây dựng nội dung hỗ trợ sinh viên.',
    icon: 'house',
    responsibilities: [
      'Tư vấn và hỗ trợ giải đáp các thắc mắc liên quan tới nhà trọ, việc làm của Sinh viên.',
      'Xây dựng nội dung và quản lý Fanpage Chuyên trang Nhà trọ & Việc làm - SACUTE - ĐH CNKT TP.HCM.',
      'Lên kế hoạch và tổ chức các hoạt động khảo sát, tư vấn nhà trọ - việc làm.',
    ],
    requirements: [
      'Đảm bảo sự cẩn thận và tinh thần trách nhiệm cao cho công việc.',
      'Có khả năng giải quyết các vấn đề phát sinh.',
      'Thái độ nhiệt tình và có thể chịu được áp lực.',
      'Có khả năng sử dụng tin học văn phòng cơ bản.',
      'Biết thiết kế đơn giản và sáng tạo nội dung là một lợi thế quan trọng.',
    ],
    benefits: [
      'Tham gia vào môi trường làm việc thân thiện, cởi mở và linh hoạt.',
      'Được nâng cao kỹ năng lập kế hoạch, được training những kỹ năng cần thiết để hoàn thành các công việc và đặc biệt là khả năng làm việc nhóm.',
      'Tham gia các hoạt động tổ chức nhà trọ, việc làm cho Sinh viên và các hoạt động khác của Trung tâm.',
    ],
  },
];
