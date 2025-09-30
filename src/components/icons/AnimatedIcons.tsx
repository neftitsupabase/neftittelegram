import Lottie from "lottie-react";
import rocketAnimation from "@/animatedIcons/rocket.json"; // adjust the path
import verifiedAnimation from "@/animatedIcons/verified.json"; // adjust the path
import globalAnimation from "@/animatedIcons/globe.json"; // adjust the path
import shieldAnimation from "@/animatedIcons/shield.json"; // adjust the path
import trophyAnimation from "@/animatedIcons/trophy.json"; // adjust the path
import happyAnimation from "@/animatedIcons/happy.json"; // adjust the path

export function RocketAnimation() {
  return (
    <div className="w-8 h-8">
      <Lottie
        animationData={rocketAnimation}
        loop={true}
        autoplay={true}
        style={{ filter: "brightness(0) invert(1)", width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function VerifiedAnimation() {
  return (
    <div className="w-8 h-8">
      <Lottie
        animationData={verifiedAnimation}
        loop={true}
        autoplay={true}
        style={{ filter: "brightness(0) invert(1)", width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function GlobalAnimation() {
  return (
    <div className="w-8 h-8">
      <Lottie
        animationData={globalAnimation}
        loop={true}
        autoplay={true}
        style={{ filter: "brightness(0) invert(1)", width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function ShieldAnimation() {
  return (
    <div className="w-8 h-8">
      <Lottie
        animationData={shieldAnimation}
        loop={true}
        autoplay={true}
        style={{ filter: "brightness(0) invert(1)", width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function TrophyAnimation() {
  return (
    <div className="w-8 h-8">
      <Lottie
        animationData={trophyAnimation}
        loop={true}
        autoplay={true}
        style={{ filter: "brightness(0) invert(1)", width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function HappyAnimation() {
  return (
    <div className="w-8 h-8">
      <Lottie
        animationData={happyAnimation}
        loop={true}
        autoplay={true}
        style={{ filter: "brightness(0) invert(1)", width: "100%", height: "100%" }}
      />
    </div>
  );
}