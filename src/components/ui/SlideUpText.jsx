import React, { forwardRef } from 'react'
import { motion } from 'motion/react'
import { cn } from '../../lib/utils'

const SlideUpText = forwardRef(function SlideUpText(
  {
    children,
    split = 'words',
    stagger = 0.03,
    duration = 0.6,
    delay = 0,
    ease = [0.22, 1, 0.36, 1],
    once = true,
    className,
    ...props
  },
  ref
) {
  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  }

  const item = {
    hidden: { y: '110%' },
    visible: {
      y: '0%',
      transition: { duration, ease },
    },
  }

  function tokenize(text, keyPrefix) {
    if (split === 'characters') {
      return text.split('').map((char, i) => {
        const key = `${keyPrefix}-c-${i}`
        if (char === ' ') {
          return (
            <span key={key} className="inline-block whitespace-pre">
              {'\u00A0'}
            </span>
          )
        }
        return (
          <span
            key={key}
            className="inline-block overflow-hidden align-bottom"
          >
            <motion.span
              className="inline-block will-change-transform"
              variants={item}
            >
              {char}
            </motion.span>
          </span>
        )
      })
    }

    // default: words
    const words = text.split(' ')
    return words.map((word, i) => (
      <React.Fragment key={`${keyPrefix}-w-${i}`}>
        <span className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block will-change-transform"
            variants={item}
          >
            {word}
          </motion.span>
        </span>
        {i < words.length - 1 ? (
          <span className="inline-block whitespace-pre">{'\u00A0'}</span>
        ) : null}
      </React.Fragment>
    ))
  }

  function renderChildren() {
    const array = React.Children.toArray(children)
    let tokenIndex = 0
    return array.map((child, index) => {
      if (typeof child === 'string') {
        tokenIndex += 1
        return (
          <React.Fragment key={`t-${index}`}>
            {tokenize(child, `t${tokenIndex}`)}
          </React.Fragment>
        )
      }
      if (React.isValidElement(child) && child.type === 'br') {
        return <br key={`br-${index}`} />
      }
      return <React.Fragment key={`other-${index}`}>{child}</React.Fragment>
    })
  }

  return (
    <motion.span
      ref={ref}
      className={cn('inline-block', className)}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-10%' }}
      {...props}
    >
      {renderChildren()}
    </motion.span>
  )
})

export default SlideUpText
