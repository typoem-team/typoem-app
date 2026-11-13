# Typoem 앱

[Typoem](https://github.com/typoem-team/typoem-web)의 Android 앱입니다. 친구들과 함께 매일 영어 시 한 편을 읽는 서비스를 휴대폰에서 이용할 수 있습니다.

앱은 [Capacitor](https://capacitorjs.com/)로 만들었습니다. 화면은 웹과 같으며, 앱에서는 아래 기능을 추가로 제공합니다.

## 앱 전용 기능

| 기능 | 설명 |
|---|---|
| 홈 화면 위젯 | 오늘의 시와 연속 읽기 기록을 홈 화면에서 보여 줍니다. |
| 아침 알림 | 설정한 시각에 매일 오늘의 시가 도착했음을 알려 줍니다. |
| 공유 | 초대 코드를 카카오톡 등 다른 앱으로 보냅니다. |
| 기기 연동 | 테마에 맞춘 상태 표시줄, Android 뒤로 가기 버튼, 진동 피드백을 지원합니다. |

## 빌드 방법

Node.js 20 이상, Android Studio, JDK 21이 필요합니다.

```bash
npm install
npm run sync      # 웹 저장소의 화면을 가져와 Android 프로젝트에 반영합니다
npm run open      # Android Studio에서 프로젝트를 엽니다
```

Android Studio에서 실행(▶)하면 휴대폰이나 에뮬레이터에 설치됩니다.

테스트는 다음 명령으로 실행합니다.

```bash
npm test
```

## 정보

- 패키지 이름: `com.typoem.app`
- 서버: https://typoem-app.onrender.com
- 최소 지원 버전: Android 7.0 (API 24)

## 팀

| 이름 | 이메일 |
| --- | --- |
| 박소연 | amypark310@gmail.com |
| 권시현 | sihyun0305@naver.com |
| 이지섭 | ljseop1030@gmail.com |
| 김경윤 | gracekim6531@naver.com |

## 라이선스

MIT License — [LICENSE](LICENSE)
