// components/Card.tsx

// ==============================
// Imports
// ==============================
import Image from "next/image";
import type { ReactNode } from "react";

import {
  actionsRow,
  buttonReset,
  cardRoot,
  contentWrap,
  excerptClass,
  imageWrap,
  linkReset,
  mediaImgCover,
  mediaRatio_1_1,
  mediaRatio_3_2,
  mediaRatio_4_3,
  mediaRatio_16_9,
  metaRow,
  titleClass,
} from "../styles/card.css";
import SmartLink from "./SmartLink";
import type { ReactElement } from "react";

// ==============================
// Types
// ==============================
type ImageProps = { src: string; alt: string; priority?: boolean };

/** Card “content” (cel existent) */
type ContentCardProps = {
  title: string;
  image?: ImageProps;
  /** Raportul zonei media (wrapper). Ex: "4/3" | "3/2" | "1/1" | "16/9". */
  mediaRatio?: `${number}/${number}`;
  excerpt?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;

  // interzicem wrapper mode aici
  children?: never;
  as?: never;
};

/** Card “shell/wrapper” (pentru Panel/HUD/modals etc.) */
type ShellCardProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  /** Element semantic pentru wrapper */
  as?: "div" | "section" | "aside" | "article";
  /** opțional: wrapperul poate fi link/button */
  href?: string;
  onClick?: () => void;

  // interzicem content mode aici
  title?: never;
  image?: never;
  mediaRatio?: never;
  excerpt?: never;
  meta?: never;
  actions?: never;
};

type Props = ContentCardProps | ShellCardProps;

// ==============================
// Utils
// ==============================
function ratioClass(ratio: `${number}/${number}`): string {
  switch (ratio) {
    case "1/1":
      return mediaRatio_1_1;
    case "3/2":
      return mediaRatio_3_2;
    case "16/9":
      return mediaRatio_16_9;
    case "4/3":
    default:
      return mediaRatio_4_3;
  }
}

// ==============================
// Component
// ==============================
export default function Card(props: Props): ReactElement {
  // ============================
  // Shell mode
  // ============================
  if ("children" in props) {
    const { children, className, href, onClick, as = "div", ["aria-label"]: ariaLabel } = props;

    const Tag = as;

    const body = (
      <Tag className={`${cardRoot} ${className ?? ""}`} aria-label={ariaLabel}>
        {children}
      </Tag>
    );

    if (href) {
      return (
        <SmartLink href={href} className={linkReset} aria-label={ariaLabel}>
          {body}
        </SmartLink>
      );
    }

    if (onClick) {
      return (
        <button type="button" className={buttonReset} onClick={onClick} aria-label={ariaLabel}>
          {body}
        </button>
      );
    }

    return body;
  }

  // ============================
  // Content mode (legacy)
  // ============================
  const {
    title,
    image,
    mediaRatio = "4/3",
    excerpt,
    meta,
    actions,
    href,
    onClick,
    className,
    "aria-label": ariaLabel,
  } = props;

  const media = image ? (
    <div className={`${imageWrap} ${ratioClass(mediaRatio)}`}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="(max-width: 900px) 100vw, 480px"
        className={mediaImgCover}
        priority={Boolean(image.priority)}
      />
    </div>
  ) : null;

  const content = (
    <div className={contentWrap}>
      <div className={titleClass}>{title}</div>
      {excerpt ? <div className={excerptClass}>{excerpt}</div> : null}
      {meta ? <div className={metaRow}>{meta}</div> : null}
      {actions ? <div className={actionsRow}>{actions}</div> : null}
    </div>
  );

  const body = (
    <article className={`${cardRoot} ${className ?? ""}`}>
      {media}
      {content}
    </article>
  );

  if (href) {
    return (
      <SmartLink href={href} className={linkReset} aria-label={ariaLabel}>
        {body}
      </SmartLink>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={buttonReset} onClick={onClick} aria-label={ariaLabel}>
        {body}
      </button>
    );
  }

  return body;
}
