/**
 * script.js - Suhan Sung Portfolio
 * 강원대학교 AI융합학과 · 202310671
 *
 * 주요 기능:
 * 1. 모바일 네비게이션 토글
 * 2. 스크롤 시 헤더 스타일 변경
 * 3. 활성 네비게이션 링크 강조
 * 4. 타이핑 애니메이션 (Typewriter Effect)
 * 5. 스크롤 등장 애니메이션 (Intersection Observer)
 * 6. 숫자 카운터 애니메이션
 * 7. 파티클 배경 생성
 * 8. 맨 위로 버튼
 * 9. 폼 제출 핸들링
 */

/* ============================================================
   1. DOM 요소 참조
   ============================================================ */
const header = document.getElementById('header');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav__link');
const backToTop = document.getElementById('backToTop');
const typingTextKo = document.getElementById('typingTextKo');
const typingTextEn = document.getElementById('typingTextEn');
const btnLangKo = document.getElementById('btnLangKo');
const btnLangEn = document.getElementById('btnLangEn');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

/* ============================================================
   2. 모바일 네비게이션 토글
   ============================================================ */
navToggle.addEventListener('click', () => {
  // 햄버거 버튼과 메뉴에 open 클래스 토글
  navToggle.classList.toggle('open');
  navMenu.classList.toggle('open');
  header.classList.toggle('open');
});

// 메뉴 링크 클릭 시 모바일 메뉴 닫기
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('open');
    navMenu.classList.remove('open');
    header.classList.remove('open');
  });
});

/* ============================================================
   2a. 다국어 설정 (Language Toggle)
   ============================================================ */
function setLanguage(lang) {
  if (lang === 'en') {
    document.body.classList.add('lang-en-active');
    if (btnLangKo) btnLangKo.classList.remove('active');
    if (btnLangEn) btnLangEn.classList.add('active');
    localStorage.setItem('preferred-language', 'en');
    
    // Update placeholders
    if (nameInput) nameInput.placeholder = 'Your Name';
    if (messageInput) messageInput.placeholder = 'Message content...';
  } else {
    document.body.classList.remove('lang-en-active');
    if (btnLangKo) btnLangKo.classList.add('active');
    if (btnLangEn) btnLangEn.classList.remove('active');
    localStorage.setItem('preferred-language', 'ko');
    
    // Update placeholders
    if (nameInput) nameInput.placeholder = '홍길동';
    if (messageInput) messageInput.placeholder = '안녕하세요! 협업 제안이 있습니다...';
  }
}

if (btnLangKo) {
  btnLangKo.addEventListener('click', () => setLanguage('ko'));
}
if (btnLangEn) {
  btnLangEn.addEventListener('click', () => setLanguage('en'));
}

// 초기 언어 설정 (localStorage 또는 브라우저 언어 감지)
const savedLang = localStorage.getItem('preferred-language') || 'ko';
setLanguage(savedLang);

/* ============================================================
   3. 스크롤 이벤트: 헤더 배경 + 맨 위로 버튼 + 활성 링크
   ============================================================ */
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;

  // 스크롤이 50px 이상이면 헤더에 배경 추가
  if (scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  // 스크롤이 300px 이상이면 맨 위로 버튼 표시
  if (scrollY > 300) {
    backToTop.classList.add('visible');
  } else {
    backToTop.classList.remove('visible');
  }

  // 현재 보이는 섹션에 따라 활성 네비게이션 링크 업데이트
  updateActiveNav();
});

/**
 * 현재 스크롤 위치에 따라 활성 nav 링크를 업데이트하는 함수
 */
function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const scrollY = window.scrollY + 100; // 헤더 높이 오프셋 추가

  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    const sectionId = section.getAttribute('id');

    // 현재 뷰포트에 해당 섹션이 보이는지 확인
    if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        // data-section 속성과 섹션 id가 일치하면 active 추가
        if (link.dataset.section === sectionId) {
          link.classList.add('active');
        }
      });
    }
  });
}

/* ============================================================
   4. 맨 위로 버튼 클릭
   ============================================================ */
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ============================================================
   5. 타이핑 애니메이션 (Typewriter Effect)
   ============================================================ */
const typingStrings = [
  'AI 🧠',
  'Physical Computing 🤖',
  'Computer Vision 👁️',
  'Vibe Coding 💻',
  '3D Printing 🖨️'
];

let stringIndex = 0;   // 현재 문자열 인덱스
let charIndex = 0;   // 현재 문자 인덱스
let isDeleting = false;

/**
 * 타이핑 효과를 처리하는 재귀 함수
 * - 타이핑 중: 한 글자씩 추가
 * - 삭제 중:  한 글자씩 제거
 */
function typeWriter() {
  const currentString = typingStrings[stringIndex];
  const substringText = currentString.substring(0, charIndex + (isDeleting ? -1 : 1));

  if (isDeleting) {
    charIndex--;
  } else {
    charIndex++;
  }

  // 양쪽 언어용 타이핑 컨테이너 업데이트
  if (typingTextKo) typingTextKo.textContent = substringText;
  if (typingTextEn) typingTextEn.textContent = substringText;

  // 타이핑 속도 설정
  let typeSpeed = isDeleting ? 60 : 110;

  // 문자열 끝에 도달: 잠시 멈춘 후 삭제 시작
  if (!isDeleting && charIndex === currentString.length) {
    typeSpeed = 2000;  // 2초 대기
    isDeleting = true;
  }
  // 삭제 완료: 다음 문자열로 이동
  else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    stringIndex = (stringIndex + 1) % typingStrings.length; // 순환
    typeSpeed = 400;
  }

  setTimeout(typeWriter, typeSpeed);
}

// 페이지 로드 후 0.8초 뒤에 타이핑 시작
setTimeout(typeWriter, 800);

/* ============================================================
   6. Intersection Observer: 스크롤 등장 애니메이션
   ============================================================ */

/**
 * .reveal 클래스 요소들이 뷰포트에 진입하면 .visible 추가
 */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // 순차적 등장을 위한 지연 (각 카드마다 100ms 간격)
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 80);
        // 한 번 등장하면 더 이상 감시하지 않음
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,          // 10% 이상 보일 때 트리거
    rootMargin: '0px 0px -50px 0px'  // 하단 50px 여유
  }
);

// 모든 .reveal 요소 감시 등록
document.querySelectorAll('.reveal').forEach(el => {
  revealObserver.observe(el);
});



/* ============================================================
   7. 숫자 카운터 애니메이션
   ============================================================ */

/**
 * 숫자를 0부터 목표값까지 애니메이션으로 증가시키는 함수
 * @param {Element} el   - 카운터 요소
 * @param {number}  target - 목표 숫자
 * @param {number}  duration - 애니메이션 시간 (ms)
 */
function animateCounter(el, target, duration = 1500) {
  let start = null;

  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    // easeOutCubic 이징 함수 적용
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target; // 최종값 정확히 설정
    }
  };

  requestAnimationFrame(step);
}

/**
 * 통계 섹션이 뷰포트에 진입하면 카운터 시작
 */
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counters = entry.target.querySelectorAll('.stat-number[data-target]');
        counters.forEach(counter => {
          const target = parseInt(counter.getAttribute('data-target'), 10);
          animateCounter(counter, target);
        });
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

const statsEl = document.querySelector('.about__stats');
if (statsEl) counterObserver.observe(statsEl);

/* ============================================================
   8. 파티클 배경 생성
   ============================================================ */

/**
 * hero 섹션 배경에 무작위 파티클 요소를 생성하는 함수
 */
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  const particleCount = 40; // 파티클 개수

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');

    // 무작위 위치, 크기, 색상, 애니메이션 속성 부여
    const x = Math.random() * 100;              // vw 기준 x좌표
    const y = Math.random() * 100;              // vh 기준 y좌표
    const size = Math.random() * 4 + 1;            // 1~5px
    const delay = Math.random() * 6;                // 0~6초 딜레이
    const duration = Math.random() * 4 + 4;            // 4~8초 애니메이션
    // 파티클 색상: 블루/퍼플/민트 랜덤
    const colors = ['#4f8ef7', '#a78bfa', '#06d6a0'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    particle.style.cssText = `
      left: ${x}%;
      top: ${y}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      animation-delay: ${delay}s;
      animation-duration: ${duration}s;
    `;

    container.appendChild(particle);
  }
}

createParticles();

/* ============================================================
   9. 폼 제출 핸들링
   ============================================================ */
contactForm.addEventListener('submit', (e) => {
  e.preventDefault(); // 기본 제출 방지

  // 입력값 가져오기
  const nameValue = document.getElementById('name').value;
  const messageValue = document.getElementById('message').value;

  // mailto 링크 빌드
  const email = 'jamessung65@naver.com';
  const isEn = document.body.classList.contains('lang-en-active');
  
  const subject = isEn 
    ? `[Portfolio Contact] Message from ${nameValue}`
    : `[포트폴리오 문의] ${nameValue}님으로부터의 메시지`;
    
  const body = isEn
    ? `Sender: ${nameValue}\n\nMessage:\n${messageValue}`
    : `보낸 사람: ${nameValue}\n\n메시지 내용:\n${messageValue}`;

  // 기본 메일 클라이언트 실행
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // 성공 알림 스타일 적용
  formSuccess.className = 'form__success';
  formSuccess.style.display = 'block';
  formSuccess.innerHTML = isEn
    ? '<i class="fa-solid fa-circle-check"></i> Mail client opened! Please send the email.'
    : '<i class="fa-solid fa-circle-check"></i> 메일 창이 열렸습니다! 메일을 전송해 주세요.';
  
  contactForm.reset(); // 폼 초기화

  // 5초 후 알림 숨기기
  setTimeout(() => {
    formSuccess.style.display = 'none';
  }, 5000);
});

/* ============================================================
   10. 네비게이션 링크 부드러운 스크롤 (보조)
   ============================================================ */
// CSS scroll-behavior: smooth가 이미 적용되어 있으나,
// 내부 앵커 링크에서 헤더 오프셋을 보장하기 위한 추가 처리
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;

    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;

    e.preventDefault();

    const navHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
      10
    );

    // 헤더 높이를 제외한 위치로 스크롤
    const targetPos = targetEl.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo({ top: targetPos, behavior: 'smooth' });
  });
});

/* ============================================================
   11. 라이트박스 (이미지 전체화면 확대)
   ============================================================ */
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');

/**
 * 라이트박스를 열고 지정된 이미지를 표시
 * @param {string} src - 표시할 이미지 경로
 */
function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  // 스크롤 잠금
  document.body.style.overflow = 'hidden';
}

/** 라이트박스 닫기 */
function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // 이미지 src 초기화 (메모리 절약)
  setTimeout(() => { lightboxImg.src = ''; }, 300);
}

// 갤러리 아이템 클릭 이벤트 등록
document.querySelectorAll('.gallery-item[data-src]').forEach(item => {
  item.addEventListener('click', () => {
    openLightbox(item.getAttribute('data-src'));
  });
});

// 닫기 버튼 & 배경 클릭으로 닫기
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);

// ESC 키로 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox.classList.contains('open')) {
    closeLightbox();
  }
});

/* ============================================================
   11.5. Apple-style 비디오 컨트롤 & 자동 재생
   ============================================================ */
const videoContainers = document.querySelectorAll('.apple-video-container');

// 음소거 아이콘 업데이트 함수
function updateMuteIcon(video, muteBtn) {
  if (video.muted) {
    muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
  } else {
    muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  }
}

videoContainers.forEach(container => {
  const video = container.querySelector('video');
  const playBtn = container.querySelector('.play-btn');
  const muteBtn = container.querySelector('.mute-btn');
  const progressBar = container.querySelector('.video-progress-bar');

  if (!video || !playBtn || !muteBtn || !progressBar) return;

  // 초기 음소거 아이콘 동기화
  updateMuteIcon(video, muteBtn);

  // 재생/일시정지 토글 이벤트
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.paused) {
      video.play().catch(err => console.log('Playback failed:', err));
    } else {
      video.pause();
    }
  });

  // 음소거 토글 이벤트
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    updateMuteIcon(video, muteBtn);
  });

  // 비디오 본체 클릭 시 재생/일시정지 토글
  container.addEventListener('click', (e) => {
    if (e.target.closest('.play-btn') || e.target.closest('.mute-btn')) return;
    
    if (video.paused) {
      video.play().catch(err => console.log('Playback failed:', err));
    } else {
      video.pause();
    }

    // 모바일 등에서 터치 시 컨트롤 유지
    container.classList.add('controls-active');
    clearTimeout(container.controlsTimeout);
    container.controlsTimeout = setTimeout(() => {
      container.classList.remove('controls-active');
    }, 2500);
  });

  // 재생 상태 변경 시 아이콘 변경
  video.addEventListener('play', () => {
    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  });

  video.addEventListener('pause', () => {
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  });

  // 진행 표시줄 업데이트
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      const progress = (video.currentTime / video.duration) * 100;
      progressBar.style.width = `${progress}%`;
    }
  });
});

// 스크롤 시 자동 재생/일시정지용 Intersection Observer
const videoObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const video = entry.target.querySelector('video');
    if (!video) return;

    if (entry.isIntersecting) {
      video.play().catch(err => {
        // 일부 브라우저에서 사용자 상호작용 전 자동재생 차단 대응
        console.log('Observer autoplay blocked/interrupted:', err);
      });
    } else {
      video.pause();
    }
  });
}, {
  threshold: 0.25 // 화면에 25% 이상 보일 때 재생 시작
});

// 모든 비디오 컨테이너 감시 등록
videoContainers.forEach(container => {
  videoObserver.observe(container);
});
/* ============================================================
   11.6. 비디오 쇼케이스 탭 전환 기능
   ============================================================ */
const showcaseTabs = document.querySelectorAll('.showcase-tab');
const showcaseViews = document.querySelectorAll('.showcase-view');

showcaseTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-target');
    
    // 탭 활성화 상태 변경
    showcaseTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // 콘텐츠 뷰 활성화 상태 변경
    showcaseViews.forEach(view => {
      const isTarget = view.classList.contains(`showcase-view--${target}`);
      const video = view.querySelector('video');
      
      if (isTarget) {
        view.classList.add('active');
        // 비디오 자동 재생 처리
        if (video) {
          video.play().catch(err => console.log('Autoplay on switch blocked:', err));
        }
      } else {
        view.classList.remove('active');
        // 이전 활성 비디오는 자원 절약을 위해 일시 정지
        if (video) {
          video.pause();
        }
      }
    });
  });
});

/* ============================================================
   12. 페이지 로드 완료 처리
   ============================================================ */
window.addEventListener('load', () => {
  // 초기 활성 링크 설정
  updateActiveNav();
  // 로딩 완료 콘솔 메시지
  console.log('%c Suhan Sung Portfolio Loaded ✓', 'color: #6366f1; font-size: 14px; font-weight: bold;');
});
