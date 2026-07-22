import { postApiV1UserLogin } from '@/request/User';
import Bgi from '@/assets/images/login-bgi.png';
import Logo from '@/assets/images/logo.png';
import Avatar from '@/components/Avatar';
import Card from '@/components/Card';
import { useURLSearchParams } from '@/hooks';
import { Box, Button, IconButton, Stack, TextField } from '@mui/material';
import { Icon, message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconZhanghao,
  IconIcon_tool_close,
  IconMima,
  IconKejian,
  IconBukejian,
} from '@orion-knowledge/icons';

/**
 * SSO 回调配置
 * 登录成功后检测 redirect 参数，判断是否需要携带 token 回调
 */
const SSO_TOKEN_PARAM = 'sso_token';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useURLSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [see, setSee] = useState(false);
  const [loading, setLoading] = useState(false);

  // 子应用模式下不允许进入登录页，直接跳转回首页
  useEffect(() => {
    if ((window as any).__POWERED_BY_ORION__) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const submit = () => {
    setLoading(true);
    postApiV1UserLogin({ account, password })
      .then(res => {
        localStorage.setItem('orion_knowledge_token', res.token!);

        // 检测是否为 SSO 回调场景（redirect 中包含 sso_token 标记或来自外部重定向）
        const redirectUrl = new URL(redirect, window.location.origin);
        const isSSORedirect = redirectUrl.searchParams.get('sso_callback') === 'true';

        if (isSSORedirect && redirectUrl.hostname === window.location.hostname) {
          // SSO 回调场景：携带 token 参数回调到原始页面
          redirectUrl.searchParams.set(SSO_TOKEN_PARAM, res.token!);
          redirectUrl.searchParams.delete('sso_callback');
          window.location.href = redirectUrl.toString();
        } else {
          // 普通登录：直接跳转
          navigate(redirect);
        }
        message.success('登录成功');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        backgroundImage: `url(${Bgi})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Stack
        direction='row'
        alignItems={'center'}
        justifyContent={'center'}
        sx={{
          width: '100%',
          height: '100%',
        }}
      >
        <Card
          sx={{
            mt: -3,
            p: 4,
            width: 458,
            boxShadow:
              '0px 0px 4px 0px rgba(54,59,76,0.1), 0px 20px 40px 0px rgba(54,59,76,0.1)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            bgcolor: 'background.paper',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Stack alignItems={'center'}>
            <Avatar src={Logo} sx={{ width: 64, height: 64, mb: 1 }} />
            <Stack
              direction={'row'}
              alignItems={'center'}
              gap={1}
              sx={{
                fontSize: 28,
                fontWeight: 700,
                color: 'text.primary',
                mb: 4,
              }}
            >
              Orion Knowledge
            </Stack>
            <TextField
              value={account}
              fullWidth
              sx={{ mb: 4 }}
              onChange={e => setAccount(e.target.value)}
              placeholder='账号'
              autoFocus
              tabIndex={1}
              slotProps={{
                input: {
                  startAdornment: (
                    <IconZhanghao sx={{ fontSize: 16, mr: 2, flexShrink: 0 }} />
                  ),
                  endAdornment: account ? (
                    <IconButton
                      onClick={() => setAccount('')}
                      size='small'
                      tabIndex={-1}
                    >
                      <IconIcon_tool_close
                        sx={{ fontSize: 14, color: 'text.tertiary' }}
                      />
                    </IconButton>
                  ) : null,
                },
              }}
            />
            <TextField
              value={password}
              fullWidth
              sx={{ mb: 4 }}
              onChange={e => setPassword(e.target.value)}
              tabIndex={2}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (!account || !password) return;
                  setLoading(true);
                  submit();
                }
              }}
              placeholder='密码'
              type={see ? 'text' : 'password'}
              slotProps={{
                input: {
                  startAdornment: (
                    <IconMima sx={{ fontSize: 16, mr: 2, flexShrink: 0 }} />
                  ),
                  endAdornment: password ? (
                    <Stack direction={'row'} alignItems={'center'}>
                      <IconButton
                        onClick={() => setSee(!see)}
                        size='small'
                        tabIndex={-1}
                      >
                        {see ? (
                          <IconKejian
                            sx={{ fontSize: 18, color: 'text.tertiary' }}
                          />
                        ) : (
                          <IconBukejian
                            sx={{ fontSize: 18, color: 'text.tertiary' }}
                          />
                        )}
                      </IconButton>
                      <IconButton
                        onClick={() => setPassword('')}
                        size='small'
                        tabIndex={-1}
                      >
                        <IconIcon_tool_close
                          sx={{ fontSize: 14, color: 'text.tertiary' }}
                        />
                      </IconButton>
                    </Stack>
                  ) : null,
                },
              }}
            />
            <Button
              fullWidth
              variant='contained'
              sx={{ height: 48 }}
              onClick={() => {
                if (!account || !password) return;
                setLoading(true);
                submit();
              }}
              loading={loading}
            >
              登录
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
};

export default Login;
