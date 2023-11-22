// Copyright 2023-present 650 Industries. All rights reserved.

import AVKit
import ExpoModulesCore

public final class VideoView: ExpoView, AVPlayerViewControllerDelegate {
  lazy var playerViewController = AVPlayerViewController()

  var player: AVPlayer? {
    didSet {
      playerViewController.player = player
    }
  }

  var isFullscreen: Bool = false
  var startPictureInPictureAutomatically = false {
    didSet {
      if #available(iOS 14.2, *) {
        playerViewController.canStartPictureInPictureAutomaticallyFromInline = startPictureInPictureAutomatically
      }
    }
  }

  var allowPictureInPicture: Bool = false {
    didSet {
      if allowPictureInPicture {
        let audioSession = AVAudioSession.sharedInstance()
        do {
          try audioSession.setCategory(.playback, mode: .default)
          try audioSession.setActive(true)
        } catch {
          print("Failed ot set audio session category. This might break picture in picture functionality")
        }
      }
      playerViewController.allowsPictureInPicturePlayback = allowPictureInPicture
    }
  }

  let onPictureInPictureStart = EventDispatcher()
  let onPictureInPictureStop = EventDispatcher()

  public override var bounds: CGRect {
    didSet {
      playerViewController.view.frame = self.bounds
    }
  }

  lazy var supportsPictureInPicture: Bool = {
    return AVPictureInPictureController.isPictureInPictureSupported()
  }()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = true
    playerViewController.delegate = self
    playerViewController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    playerViewController.view.backgroundColor = .clear

    addSubview(playerViewController.view)
  }

  func enterFullscreen() {
    if isFullscreen {
      return
    }
    let selectorName = "enterFullScreenAnimated:completionHandler:"
    let selectorToForceFullScreenMode = NSSelectorFromString(selectorName)

    if playerViewController.responds(to: selectorToForceFullScreenMode) {
      playerViewController.perform(selectorToForceFullScreenMode, with: true, with: nil)
    }
  }

  func exitFullscreen() {
    if !isFullscreen {
      return
    }
    let selectorName = "exitFullScreenAnimated:completionHandler:"
    let selectorToExitFullScreenMode = NSSelectorFromString(selectorName)

    if playerViewController.responds(to: selectorToExitFullScreenMode) {
      playerViewController.perform(selectorToExitFullScreenMode, with: true, with: nil)
    }
  }

  func startPictureInPicture(promise: Promise) {
    if !supportsPictureInPicture {
      promise.reject(PictureInPictureUnsupportedException())
      return
    }

    let selectorName = "startPictureInPicture"
    let selectorToStartPictureInPicture = NSSelectorFromString(selectorName)

    if playerViewController.responds(to: selectorToStartPictureInPicture) {
      playerViewController.perform(selectorToStartPictureInPicture)
    }
    promise.resolve(nil)
  }

  func stopPictureInPicture() {
    let selectorName = "stopPictureInPicture"
    let selectorToStopPictureInPicture = NSSelectorFromString(selectorName)

    if playerViewController.responds(to: selectorToStopPictureInPicture) {
      playerViewController.perform(selectorToStopPictureInPicture)
    }
  }

  // MARK: - AVPlayerViewControllerDelegate

  public func playerViewController(
    _ playerViewController: AVPlayerViewController,
    willBeginFullScreenPresentationWithAnimationCoordinator coordinator: UIViewControllerTransitionCoordinator
  ) {
    isFullscreen = true
  }

  public func playerViewController(
    _ playerViewController: AVPlayerViewController,
    willEndFullScreenPresentationWithAnimationCoordinator coordinator: UIViewControllerTransitionCoordinator
  ) {
    // Platform's behavior is to pause the player when exiting the fullscreen mode.
    // It seems better to continue playing, so we resume the player once the dismissing animation finishes.
    let wasPlaying = player?.timeControlStatus == .playing

    coordinator.animate(alongsideTransition: nil) { context in
      if !context.isCancelled {
        if wasPlaying {
          self.player?.play()
        }
        self.isFullscreen = false
      }
    }
  }

  public func playerViewControllerDidStartPictureInPicture(_ playerViewController: AVPlayerViewController) {
    onPictureInPictureStart()
  }

  public func playerViewControllerDidStopPictureInPicture(_ playerViewController: AVPlayerViewController) {
    onPictureInPictureStop()
  }
}
